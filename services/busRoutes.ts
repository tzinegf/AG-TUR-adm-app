import { supabase, BusRoute } from '../lib/supabase';

export const busRoutesService = {
  async searchRoutes(origin: string, destination: string, date: Date) {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('origin', origin)
      .eq('destination', destination)
      .order('departure', { ascending: true });

    if (error) throw error;
    return data as BusRoute[];
  },

  async getRoute(id: string) {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as BusRoute;
  },

  async getPopularRoutes() {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('departure', { ascending: true })
      .limit(10);

    if (error) throw error;
    return data as BusRoute[];
  },

  // Admin functions
  async createRoute(route: Omit<BusRoute, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('routes')
      .insert(route)
      .select()
      .single();

    if (error) {
      console.error('Error creating route:', error);
      throw error;
    }
    return data as BusRoute;
  },

  async updateRoute(id: string, updates: Partial<BusRoute>) {
    const { data, error } = await supabase
      .from('routes')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating route:', error);
      throw error;
    }
    return data as BusRoute;
  },

  async deleteRoute(id: string) {
    const { data, error } = await supabase
      .from('routes')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error deleting route:', error);
      throw error;
    }
    return data as BusRoute;
  },

  // Get all routes for admin
  async getAllRoutes() {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .order('departure', { ascending: true });

    if (error) {
      console.error('Error fetching all routes:', error);
      throw error;
    }
    return data as BusRoute[];
  },
};
