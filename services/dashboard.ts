import { supabase } from '../lib/supabase';

export interface DashboardStats {
  totalBookings: number;
  activeRoutes: number;
  totalBuses: number;
  totalUsers: number;
  todayRevenue: number;
  monthRevenue: number;
}

export interface RecentActivity {
  id: string;
  type: 'booking' | 'route' | 'user';
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}

export const dashboardService = {
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      console.log('📊 Iniciando busca de estatísticas do dashboard...');
      
      // Buscar dados reais do Supabase agora que o admin está autenticado
      const [
        totalBookingsResult,
        activeRoutesResult,
        totalBusesResult,
        totalUsersResult,
        todayRevenueResult,
        monthRevenueResult
      ] = await Promise.all([
        // Total de reservas
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true }),
        
        // Rotas ativas (assumindo que rotas com assentos disponíveis são ativas)
        supabase
          .from('routes')
          .select('id', { count: 'exact', head: true }),
          
          
        
        // Total de ônibus 
        supabase
          .from('buses')
          .select('id', { count: 'exact', head: true }),
          
        
        // Total de usuários
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'user'),
        
        // Receita de hoje
        supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed')
          .gte('created_at', new Date().toISOString().split('T')[0]),
        
        // Receita do mês
        supabase
          .from('payments')
          .select('amount')
          .eq('status', 'completed')
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
      ]);

      console.log('📈 Resultados das consultas:');
      console.log('- Total de reservas:', totalBookingsResult.count);
      console.log('- Rotas ativas:', activeRoutesResult.count);
      console.log('- Ônibus encontrados:', totalBusesResult.data?.length);
      console.log('- Total de usuários:', totalUsersResult.count);
      console.log('- Pagamentos hoje:', todayRevenueResult.data?.length);
      console.log('- Pagamentos do mês:', monthRevenueResult.data?.length);

     

      // Calcular receitas
      const todayRevenue = todayRevenueResult.data?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
      const monthRevenue = monthRevenueResult.data?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;

      const stats: DashboardStats = {
        totalBookings: totalBookingsResult.count || 0,
        activeRoutes: activeRoutesResult.count || 0,
        totalBuses: totalBusesResult.count|| 0, // Usando número de empresas como proxy para ônibus
        totalUsers: totalUsersResult.count || 0,
        todayRevenue,
        monthRevenue,
      };

      console.log('✅ Estatísticas finais:', stats);
      return stats;

      // TODO: Implementar autenticação real do admin no Supabase
      // Código original comentado para referência futura:
      /*
      // Get total bookings (admins can see all bookings)
      console.log('📊 Buscando total de reservas...');
      const { count: totalBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true });
      
      if (bookingsError) {
        console.error('❌ Erro ao buscar reservas:', bookingsError);
      } else {
        console.log('✅ Total de reservas encontradas:', totalBookings);
      }

      // Get active routes (anyone can view active routes)
      console.log('🚌 Buscando rotas ativas...');
      const { count: activeRoutes, error: routesError } = await supabase
        .from('routes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      if (routesError) {
        console.error('❌ Erro ao buscar rotas:', routesError);
      } else {
        console.log('✅ Total de rotas ativas encontradas:', activeRoutes);
      }

      // Get total buses (unique bus companies for now, since we don't have a buses table)
      console.log('🚐 Buscando empresas de ônibus...');
      const { data: busCompanies, error: busError } = await supabase
        .from('routes')
        .select('bus_company')
        .eq('status', 'active');

      if (busError) {
        console.error('❌ Erro ao buscar empresas:', busError);
      } else {
        console.log('✅ Empresas encontradas:', busCompanies?.length);
      }

      const uniqueBusCompanies = new Set(busCompanies?.map(route => route.bus_company) || []);
      const totalBuses = uniqueBusCompanies.size * 3; // Estimate 3 buses per company
      console.log('🚌 Total estimado de ônibus:', totalBuses);

      // Get total users (admins can see all profiles)
      console.log('👥 Buscando total de usuários...');
      const { count: totalUsers, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'user');

      if (usersError) {
        console.error('❌ Erro ao buscar usuários:', usersError);
      } else {
        console.log('✅ Total de usuários encontrados:', totalUsers);
      }

      // Get today's revenue (admins can see all bookings)
      console.log('💰 Calculando receita de hoje...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayBookings, error: todayError } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('payment_status', 'completed')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (todayError) {
        console.error('❌ Erro ao buscar receita de hoje:', todayError);
      } else {
        console.log('✅ Reservas pagas hoje:', todayBookings?.length);
      }

      const todayRevenue = todayBookings?.reduce((sum, booking) => sum + booking.total_price, 0) || 0;
      console.log('💵 Receita de hoje:', todayRevenue);

      // Get this month's revenue (admins can see all bookings)
      console.log('📅 Calculando receita do mês...');
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const { data: monthBookings, error: monthError } = await supabase
        .from('bookings')
        .select('total_price')
        .eq('payment_status', 'completed')
        .gte('created_at', startOfMonth.toISOString())
        .lt('created_at', startOfNextMonth.toISOString());

      if (monthError) {
        console.error('❌ Erro ao buscar receita do mês:', monthError);
      } else {
        console.log('✅ Reservas pagas no mês:', monthBookings?.length);
      }

      const monthRevenue = monthBookings?.reduce((sum, booking) => sum + booking.total_price, 0) || 0;
      console.log('💵 Receita do mês:', monthRevenue);

      const stats = {
        totalBookings: totalBookings || 0,
        activeRoutes: activeRoutes || 0,
        totalBuses,
        totalUsers: totalUsers || 0,
        todayRevenue,
        monthRevenue,
      };

      console.log('📈 Estatísticas finais:', stats);
      return stats;
      */
    } catch (error) {
      console.error('💥 Erro geral ao buscar estatísticas:', error);
      
      // Return default values if there's an error
      return {
        totalBookings: 0,
        activeRoutes: 0,
        totalBuses: 0,
        totalUsers: 0,
        todayRevenue: 0,
        monthRevenue: 0,
      };
    }
  },

  async getRecentActivities(): Promise<RecentActivity[]> {
    try {
      console.log('📋 Buscando atividades recentes...');
      
      const activities: RecentActivity[] = [];

      // Get recent bookings
      console.log('🎫 Buscando reservas recentes...');
      const { data: recentBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          created_at,
          passenger_name,
          routes!inner (
            origin,
            destination
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (bookingsError) {
        console.error('❌ Erro ao buscar reservas recentes:', bookingsError);
      } else {
        console.log('✅ Reservas recentes encontradas:', recentBookings?.length);
      }

      recentBookings?.forEach(booking => {
        const route = booking.routes as any;
        activities.push({
          id: `booking-${booking.id}`,
          type: 'booking',
          description: `Nova reserva de ${booking.passenger_name} para ${route?.origin} → ${route?.destination}`,
          timestamp: booking.created_at,
          icon: 'checkmark-circle',
          color: '#10B981',
        });
      });

      // Get recent routes
      console.log('🚌 Buscando rotas recentes...');
      const { data: recentRoutes, error: routesError } = await supabase
        .from('routes')
        .select('id, created_at, origin, destination')
        .order('created_at', { ascending: false })
        .limit(3);

      if (routesError) {
        console.error('❌ Erro ao buscar rotas recentes:', routesError);
      } else {
        console.log('✅ Rotas recentes encontradas:', recentRoutes?.length);
      }

      recentRoutes?.forEach(route => {
        activities.push({
          id: `route-${route.id}`,
          type: 'route',
          description: `Nova rota criada: ${route.origin} → ${route.destination}`,
          timestamp: route.created_at,
          icon: 'bus',
          color: '#3B82F6',
        });
      });

      // Get recent users
      console.log('👤 Buscando usuários recentes...');
      const { data: recentUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, created_at, name')
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(3);

      if (usersError) {
        console.error('❌ Erro ao buscar usuários recentes:', usersError);
      } else {
        console.log('✅ Usuários recentes encontrados:', recentUsers?.length);
      }

      recentUsers?.forEach(user => {
        activities.push({
          id: `user-${user.id}`,
          type: 'user',
          description: `Novo usuário cadastrado: ${user.name || 'Usuário'}`,
          timestamp: user.created_at,
          icon: 'person-add',
          color: '#8B5CF6',
        });
      });

      // Sort by timestamp (most recent first)
      const sortedActivities = activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      console.log('📊 Total de atividades encontradas:', sortedActivities.length);
      
      return sortedActivities.slice(0, 10); // Return top 10 most recent
    } catch (error) {
      console.error('💥 Erro ao buscar atividades recentes:', error);
      return [];
    }
  },

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  },

  formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Agora mesmo';
    if (diffInMinutes < 60) return `Há ${diffInMinutes} minuto${diffInMinutes > 1 ? 's' : ''}`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Há ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `Há ${diffInDays} dia${diffInDays > 1 ? 's' : ''}`;
  },
};