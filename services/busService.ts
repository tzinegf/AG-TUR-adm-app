import { supabase } from '../lib/supabase';
import { Bus } from '../lib/supabase';

export const busService = {
  // Buscar todos os ônibus
  async getAllBuses(): Promise<Bus[]> {
    try {
      const { data, error } = await supabase
        .from('buses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar ônibus:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço getAllBuses:', error);
      throw error;
    }
  },

  // Buscar ônibus por ID
  async getBusById(id: string): Promise<Bus | null> {
    try {
      const { data, error } = await supabase
        .from('buses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Erro ao buscar ônibus por ID:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro no serviço getBusById:', error);
      throw error;
    }
  },

  // Criar novo ônibus
  async createBus(busData: Omit<Bus, 'id' | 'created_at' | 'updated_at'>): Promise<Bus> {
    try {
      const { data, error } = await supabase
        .from('buses')
        .insert([{
          ...busData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar ônibus:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro no serviço createBus:', error);
      throw error;
    }
  },

  // Atualizar ônibus
  async updateBus(id: string, busData: Partial<Omit<Bus, 'id' | 'created_at' | 'updated_at'>>): Promise<Bus> {
    try {
      const { data, error } = await supabase
        .from('buses')
        .update({
          ...busData,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar ônibus:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro no serviço updateBus:', error);
      throw error;
    }
  },

  // Deletar ônibus
  async deleteBus(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('buses')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao deletar ônibus:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erro no serviço deleteBus:', error);
      throw error;
    }
  },

  // Buscar ônibus por status
  async getBusesByStatus(status: 'active' | 'maintenance' | 'inactive'): Promise<Bus[]> {
    try {
      const { data, error } = await supabase
        .from('buses')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar ônibus por status:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço getBusesByStatus:', error);
      throw error;
    }
  },

  // Buscar ônibus por tipo
  async getBusesByType(type: 'convencional' | 'executivo' | 'leito'): Promise<Bus[]> {
    try {
      const { data, error } = await supabase
        .from('buses')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar ônibus por tipo:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro no serviço getBusesByType:', error);
      throw error;
    }
  }
};