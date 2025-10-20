import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  role: 'user' | 'admin' | 'manager' | 'driver';
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLogin: string;
  totalBookings: number;
  totalSpent: number;
  avatar?: string;
  bookings?: Booking[];
}

export interface Booking {
  id: string;
  bookingCode: string;
  routeName: string;
  departureDate: string;
  departureTime: string;
  price: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  seatNumber: string;
}

export interface UserSearchParams {
  page?: number;
  limit?: number;
  query?: string;
  role?: User['role'];
  status?: User['status'];
}

export interface UserSearchResult {
  users: User[];
  total: number;
  hasMore: boolean;
}

class UserService {
  private readonly TABLE_NAME = 'profiles';

  async searchUsers(params: UserSearchParams = {}): Promise<UserSearchResult> {
    try {
      const {
        page = 1,
        limit = 10,
        query = '',
        role,
        status
      } = params;

      const offset = (page - 1) * limit;

      let queryBuilder = supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact' });

      if (query) {
        queryBuilder = queryBuilder.or(
          `name.ilike.%${query}%,email.ilike.%${query}%,cpf.ilike.%${query}%`
        );
      }

      if (role) {
        queryBuilder = queryBuilder.eq('role', role);
      }

      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      const { data: users, count, error } = await queryBuilder
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        users: users as User[],
        total: count || 0,
        hasMore: (count || 0) > offset + users.length
      };
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      throw new Error('Não foi possível buscar os usuários');
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      const { data: user, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!user) throw new Error('Usuário não encontrado');

      return user as User;
    } catch (error) {
      console.error('Erro ao buscar usuário por ID:', error);
      throw new Error('Não foi possível buscar o usuário');
    }
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    try {
      const { data: user, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([userData])
        .select()
        .single();

      if (error) throw error;
      if (!user) throw new Error('Erro ao criar usuário');

      return user as User;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw new Error('Não foi possível criar o usuário');
    }
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    try {
      const { data: user, error } = await supabase
        .from(this.TABLE_NAME)
        .update(userData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!user) throw new Error('Usuário não encontrado');

      return user as User;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw new Error('Não foi possível atualizar o usuário');
    }
  }

  async updateUserStatus(id: string, status: User['status']): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar status do usuário:', error);
      throw new Error('Não foi possível atualizar o status do usuário');
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      throw new Error('Não foi possível enviar o email de redefinição de senha');
    }
  }
}

export const userService = new UserService();