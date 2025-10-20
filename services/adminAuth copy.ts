import { supabase } from '../lib/supabase';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager';
}

export const adminAuthService = {
  async signInAdmin(email: string, password: string): Promise<{ user: AdminUser | null; error: string | null }> {
    try {
      // Verificar conexão com Supabase e configuração
      console.log('Verificando conexão com Supabase...');
      if (!supabase.auth) {
        console.error('Erro: Cliente Supabase não está configurado corretamente');
        return { user: null, error: 'Erro de configuração do servidor. Entre em contato com o suporte.' };
      }

      // Verificar conexão com a API do Supabase
      const { error: healthError } = await supabase.from('profiles').select('count').limit(1);
      if (healthError) {
        console.error('Erro de conexão com Supabase:', healthError.message);
        if (healthError.message.includes('JWT')) {
          return { user: null, error: 'Erro de autenticação do servidor. Tente novamente mais tarde.' };
        }
        if (healthError.message.includes('network')) {
          return { user: null, error: 'Erro de conexão com o servidor. Verifique sua internet.' };
        }
        return { user: null, error: 'Erro de conexão com o servidor. Tente novamente.' };
      }
      
      console.log('Conexão com Supabase estabelecida com sucesso');

      // Autenticar com Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Erro de autenticação Supabase:', authError.message);
        if (authError.message.includes('Invalid login credentials')) {
          return { user: null, error: 'Credenciais de login inválidas. Verifique seu email e senha.' };
        }
        return { user: null, error: `Erro de autenticação: ${authError.message}` };
      }

      if (!authData.user) {
        return { user: null, error: 'Usuário não encontrado' };
      }

      // Verificar se o usuário tem perfil de admin
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
        return { user: null, error: 'Erro ao verificar permissões de administrador' };
      }

      if (!profile) {
        console.error('Perfil não encontrado para o usuário:', authData.user.id);
        await supabase.auth.signOut();
        return { user: null, error: 'Perfil de usuário não encontrado.' };
      }

      // Verificar permissões de admin de forma mais flexível
      const userRole = (profile.role || profile.user_role || profile.type || '').toLowerCase();
      const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'administrador';

      if (!isAdmin) {
        console.error('Usuário não tem permissão de admin. Role:', userRole);
        await supabase.auth.signOut();
        return { user: null, error: 'Acesso negado. Usuário não tem permissões de administrador.' };
      }

      const adminUser: AdminUser = {
        id: profile.id,
        email: profile.email || authData.user.email || '',
        name: profile.full_name || profile.name || 'Admin',
        role: 'admin'
      };

      return { user: adminUser, error: null };
    } catch (error) {
      console.error('Erro na autenticação admin:', error);
      return { user: null, error: 'Erro interno do servidor. Tente novamente.' };
    }
  },

  async signOutAdmin(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getCurrentAdminUser(): Promise<AdminUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return null;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .eq('role', 'admin')
        .single();

      if (error || !profile) return null;

      return {
        id: profile.id,
        email: profile.email,
        name: profile.full_name,
        role: profile.role as 'admin' | 'manager'
      };
    } catch (error) {
      console.error('Erro ao obter usuário admin atual:', error);
      return null;
    }
  },

  async createAdminUser(email: string, password: string, fullName: string): Promise<{ success: boolean; error: string | null }> {
    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullName,
            role: 'admin'
          }
        }
      });

      if (authError) {
        return { success: false, error: authError.message };
      }

      if (!authData.user) {
        return { success: false, error: 'Falha ao criar usuário' };
      }

      // Criar perfil de admin
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          name: fullName,
          phone: '',
          role: 'admin'
        });

      if (profileError) {
        return { success: false, error: profileError.message };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Erro ao criar usuário admin:', error);
      return { success: false, error: 'Erro interno do servidor' };
    }
  }
};