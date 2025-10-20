import { supabase, Booking, Payment } from '../lib/supabase';
import { seatsService } from './seats';

export const bookingsService = {
  async createBooking(
    routeId: string,
    seatIds: string[], // Mudança: agora recebe IDs das poltronas em vez de números
    totalPrice: number,
    paymentMethod: string,
    passengerInfo?: { name?: string; document?: string }[]
  ) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // For development, create a mock booking if user is not authenticated
        console.warn('User not authenticated, creating mock booking for development');
        const mockBooking = {
          id: 'mock-booking-' + Date.now(),
          user_id: 'mock-user',
          route_id: routeId,
          // Assentos serão armazenados via booking_seats
          passenger_name: 'Mock User',
          passenger_document: '000.000.000-00',
          total_price: totalPrice,
          payment_status: 'pending' as const,
          status: 'confirmed' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return mockBooking as Booking;
      }

      // Verificar disponibilidade das poltronas antes de criar a reserva
      const seatsAvailable = await seatsService.checkSeatsAvailability(seatIds);
      if (!seatsAvailable) {
        throw new Error('Uma ou mais poltronas selecionadas não estão mais disponíveis');
      }

      // Buscar os números das poltronas a partir dos IDs selecionados
      const { data: seatRows, error: seatFetchError } = await supabase
        .from('seats')
        .select('id, seat_number')
        .in('id', seatIds);

      if (seatFetchError) throw seatFetchError;

      const seatNumbers: string[] = (seatRows || [])
        .filter((s: any) => !!s?.seat_number)
        .map((s: any) => s.seat_number);

      // Garantir que temos a mesma quantidade de números que IDs
      if (seatNumbers.length !== seatIds.length) {
        console.warn('Diferença entre seat_numbers e seatIds', { seatNumbers, seatIds });
      }

      // Base comum da reserva
      const baseInsert = {
        user_id: user.id,
        route_id: routeId,
        total_price: totalPrice,
        payment_method: paymentMethod,
        payment_status: 'pending',
      } as Record<string, any>;

      let booking: any = null;
      let bookingError: any = null;

      // Tentativa 1: inserir usando coluna 'seats'
      {
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            ...baseInsert,
            seats: seatNumbers,
          })
          .select()
          .single();
        booking = data;
        bookingError = error;
      }

      // Se coluna 'seats' não existir, tentar 'seat_numbers'
      if (bookingError && (
        bookingError?.code === 'PGRST204' ||
        (typeof bookingError?.message === 'string' && bookingError.message.includes("'seats' column"))
      )) {
        const { data, error } = await supabase
          .from('bookings')
          .insert({
            ...baseInsert,
            seat_numbers: seatNumbers,
          })
          .select()
          .single();
        booking = data;
        bookingError = error;
      }

      if (bookingError) throw bookingError;

      // Reservar as poltronas no sistema
      try {
        await seatsService.reserveSeats(booking.id, seatIds, passengerInfo);
      } catch (seatError: any) {
        // Se falhar ao reservar poltronas, cancelar a reserva
        await supabase.from('bookings').delete().eq('id', booking.id);
        throw new Error('Falha ao reservar poltronas: ' + (seatError?.message || 'Erro desconhecido'));
      }

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          booking_id: booking.id,
          amount: totalPrice,
          method: paymentMethod,
          status: 'pending',
        });

      if (paymentError) {
        const message = String((paymentError as any)?.message || '');
        const isMissingPaymentsTable = message.includes("Could not find the table 'public.payments'");

        if (isMissingPaymentsTable) {
          // Se a tabela payments não existir no ambiente, prosseguir sem criar pagamento
          console.warn('Tabela payments ausente. Pulando criação de pagamento e mantendo a reserva.');
        } else {
          // Se falhar ao criar pagamento por outro motivo, liberar poltronas e cancelar reserva
          await seatsService.releaseSeats(booking.id);
          await supabase.from('bookings').delete().eq('id', booking.id);
          throw paymentError;
        }
      }

      return booking as Booking;
    } catch (error) {
      console.error('Booking service error:', error);
      throw error;
    }
  },

  async getUserBookings() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        route:routes(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Booking[];
  },

  async getBooking(id: string) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        route:routes(*),
        user:profiles(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Booking;
  },

  async updateBookingPayment(bookingId: string, status: 'completed' | 'failed') {
    const qrCode = status === 'completed' 
      ? `AG-TUR-${bookingId}-${Date.now()}` 
      : null;

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        payment_status: status,
        qr_code: qrCode,
      })
      .eq('id', bookingId);

    if (bookingError) throw bookingError;

    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        status,
        transaction_id: `TXN-${Date.now()}`,
      })
      .eq('booking_id', bookingId);

    if (paymentError) {
      const message = String((paymentError as any)?.message || '');
      const isMissingPaymentsTable = message.includes("Could not find the table 'public.payments'");
      if (!isMissingPaymentsTable) {
        throw paymentError;
      } else {
        console.warn('Tabela payments ausente ao atualizar pagamento. Atualização ignorada.');
      }
    }
  },

  async cancelBooking(id: string) {
    try {
      // Primeiro, liberar as poltronas
      await seatsService.releaseSeats(id);
      
      // Depois, cancelar a reserva
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error cancelling booking:', error);
      throw error;
    }
  },

  // Admin functions
  async getAllBookings() {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        route:routes(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const bookings = (data || []) as any[];
    const userIds = Array.from(new Set(bookings.map((b: any) => b?.user_id).filter(Boolean)));

    let profilesById: Record<string, any> = {};
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id,name,email')
        .in('id', userIds);
      if (!profilesError && profiles) {
        profilesById = (profiles as any[]).reduce((acc: Record<string, any>, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    const enriched = bookings.map((b: any) => ({
      ...b,
      user: profilesById[b.user_id] || null,
    }));

    return enriched as Booking[];
  },

  async getBookingStats() {
    const { data: totalBookings, error: totalError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact' });

    const { data: completedBookings, error: completedError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('payment_status', 'completed');

    const { data: revenue, error: revenueError } = await supabase
      .from('bookings')
      .select('total_price')
      .eq('payment_status', 'completed');

    if (totalError || completedError || revenueError) {
      throw new Error('Failed to fetch stats');
    }

    const totalRevenue = revenue?.reduce((sum, booking) => sum + booking.total_price, 0) || 0;

    return {
      totalBookings: totalBookings?.length || 0,
      completedBookings: completedBookings?.length || 0,
      totalRevenue,
    };
  },
};
