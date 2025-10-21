import { supabase } from '../lib/supabase';

export type DiscountType = 'percentage' | 'fixed';

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status: 'active' | 'inactive';
  usage_limit?: number | null;
  used_count: number;
  created_at?: string;
  updated_at?: string;
}

export const couponsService = {
  async getAll(): Promise<Coupon[]> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Coupon[];
  },

  async getActiveCount(): Promise<number> {
    const { count, error } = await supabase
      .from('coupons')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (error) throw error;
    return count || 0;
  },

  async create(coupon: Omit<Coupon, 'id' | 'used_count' | 'created_at' | 'updated_at'>): Promise<Coupon> {
    const payload: any = {
      code: coupon.code.toUpperCase(),
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      starts_at: coupon.starts_at || null,
      ends_at: coupon.ends_at || null,
      status: coupon.status,
      usage_limit: coupon.usage_limit ?? null,
    };
    const { data, error } = await supabase
      .from('coupons')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data as Coupon;
  },

  async update(id: string, changes: Partial<Omit<Coupon, 'id'>>): Promise<Coupon> {
    const payload: any = { ...changes };
    if (payload.code) payload.code = String(payload.code).toUpperCase();
    const { data, error } = await supabase
      .from('coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Coupon;
  },

  async validateAndGet(code: string): Promise<Coupon> {
    const norm = code.trim().toUpperCase();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', norm)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !data) {
      throw new Error('Cupom não encontrado ou inativo');
    }

    const coupon = data as Coupon;
    const nowISO = new Date().toISOString();

    // Janela de validade
    if (coupon.starts_at && nowISO < coupon.starts_at) {
      throw new Error('Cupom ainda não válido');
    }
    if (coupon.ends_at && nowISO > coupon.ends_at) {
      throw new Error('Cupom expirado');
    }

    // Limite total de uso
    if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
      throw new Error('Limite de uso do cupom atingido');
    }

    // Uso único por usuário (se usuário conhecido)
    if (user?.id) {
      const { data: existing, error: usageErr } = await supabase
        .from('coupon_usages')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (usageErr) throw usageErr;
      if (existing) throw new Error('Você já utilizou este cupom.');
    }

    return coupon;
  },

  computeDiscountedTotal(currentPrice: number, coupon: Coupon): number {
    let discountApplied = 0;
    if (coupon.discount_type === 'percentage') {
      discountApplied = Number(((currentPrice * coupon.discount_value) / 100).toFixed(2));
    } else {
      discountApplied = Number(coupon.discount_value.toFixed(2));
    }
    const newPrice = Math.max(0, Number((currentPrice - discountApplied).toFixed(2)));
    return newPrice;
  },

  async applyToBooking(bookingId: string, code: string): Promise<{ newPrice: number; discountApplied: number; coupon: Coupon }>{
    const coupon = await this.validateAndGet(code);

    // Buscar preço e usuário da reserva
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, total_price, user_id')
      .eq('id', bookingId)
      .single();
    if (bookingError) throw bookingError;

    const userId = (booking as any)?.user_id || null;
    const currentPrice = Number((booking as any)?.total_price || 0);
    let discountApplied = 0;
    if (coupon.discount_type === 'percentage') {
      discountApplied = Number(((currentPrice * coupon.discount_value) / 100).toFixed(2));
    } else {
      discountApplied = Number(coupon.discount_value.toFixed(2));
    }
    const newPrice = Math.max(0, Number((currentPrice - discountApplied).toFixed(2)));

    // Registrar uso (DB trigger valida e incrementa used_count)
    const { error: usageError } = await supabase
      .from('coupon_usages')
      .insert({
        coupon_id: coupon.id,
        booking_id: bookingId,
        user_id: userId,
        amount_before: currentPrice,
        amount_discount: discountApplied,
        amount_after: newPrice,
        applied_at: new Date().toISOString(),
      });
    if (usageError) throw usageError;

    // Atualizar preço da reserva
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ total_price: newPrice })
      .eq('id', bookingId);
    if (updateError) throw updateError;

    return { newPrice, discountApplied, coupon };
  }
};