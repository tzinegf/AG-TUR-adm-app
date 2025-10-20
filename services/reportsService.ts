import { supabase } from '../lib/supabase';

export interface ReportFilter {
  startDate: string;
  endDate: string;
  type?: string;
  status?: string;
}

export interface SalesReport {
  id: string;
  date: string;
  route: string;
  passenger: string;
  amount: number;
  status: string;
  paymentMethod: string;
}

export interface UsersReport {
  id: string;
  name: string;
  email: string;
  phone: string;
  registrationDate: string;
  totalBookings: number;
  totalSpent: number;
}

export interface RoutesReport {
  id: string;
  origin: string;
  destination: string;
  totalBookings: number;
  totalRevenue: number;
  averageOccupancy: number;
  status: string;
}

export interface BusesReport {
  id: string;
  plate: string;
  model: string;
  brand: string;
  totalTrips: number;
  totalRevenue: number;
  maintenanceStatus: string;
  lastMaintenance?: string;
}

export interface ReportSummary {
  totalRevenue: number;
  totalBookings: number;
  averageTicketValue: number;
  topRoute: string;
  topBus: string;
  period: string;
}

export const reportsService = {
  // Relatório de Vendas
  async getSalesReport(filter: ReportFilter): Promise<SalesReport[]> {
    try {
      console.log('📊 Gerando relatório de vendas...', filter);

      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          created_at,
          status,
          total_price,
          routes (
            origin,
            destination
          ),
          profiles (
            full_name,
            email
          ),
          payments (
            payment_method,
            status
          )
        `)
        .gte('created_at', filter.startDate)
        .lte('created_at', filter.endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data?.map(booking => ({
        id: booking.id,
        date: new Date(booking.created_at).toLocaleDateString('pt-BR'),
        route: `${booking.routes?.[0]?.origin} → ${booking.routes?.[0]?.destination}`,
        passenger: booking.profiles?.[0]?.full_name || 'N/A',
        amount: booking.total_price || 0,
        status: booking.status,
        paymentMethod: booking.payments?.[0]?.payment_method || 'N/A'
      })) || [];

    } catch (error) {
      console.error('❌ Erro ao gerar relatório de vendas:', error);
      throw error;
    }
  },

  // Relatório de Usuários
  async getUsersReport(filter: ReportFilter): Promise<UsersReport[]> {
    try {
      console.log('👥 Gerando relatório de usuários...', filter);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          phone,
          created_at,
          bookings (
            id,
            total_price
          )
        `)
        .eq('role', 'user')
        .gte('created_at', filter.startDate)
        .lte('created_at', filter.endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data?.map(user => {
        const totalBookings = user.bookings?.length || 0;
        const totalSpent = user.bookings?.reduce((sum, booking) => sum + (booking.total_price || 0), 0) || 0;

        return {
          id: user.id,
          name: user.name || 'N/A',
          email: user.email || 'N/A',
          phone: user.phone || 'N/A',
          registrationDate: new Date(user.created_at).toLocaleDateString('pt-BR'),
          totalBookings,
          totalSpent
        };
      }) || [];

    } catch (error) {
      console.error('❌ Erro ao gerar relatório de usuários:', error);
      throw error;
    }
  },

  // Relatório de Rotas
  async getRoutesReport(filter: ReportFilter): Promise<RoutesReport[]> {
    try {
      console.log('🛣️ Gerando relatório de rotas...', filter);

      const { data, error } = await supabase
        .from('routes')
        .select(`
          id,
          origin,
          destination,
          status,
          available_seats,
          total_seats,
          bookings (
            id,
            total_price,
            status,
            created_at
          )
        `)
        .order('origin');

      if (error) throw error;

      return data?.map(route => {
        // Filtrar bookings pelo período
        const filteredBookings = route.bookings?.filter(booking => 
          booking.created_at >= filter.startDate && booking.created_at <= filter.endDate
        ) || [];

        const totalBookings = filteredBookings.length;
        const totalRevenue = filteredBookings.reduce((sum, booking) => sum + (booking.total_price || 0), 0);
        const occupancyRate = route.total_seats ? ((route.total_seats - route.available_seats) / route.total_seats) * 100 : 0;

        return {
          id: route.id,
          origin: route.origin,
          destination: route.destination,
          totalBookings,
          totalRevenue,
          averageOccupancy: Math.round(occupancyRate),
          status: route.status
        };
      }) || [];

    } catch (error) {
      console.error('❌ Erro ao gerar relatório de rotas:', error);
      throw error;
    }
  },

  // Relatório de Ônibus
  async getBusesReport(filter: ReportFilter): Promise<BusesReport[]> {
    try {
      console.log('🚌 Gerando relatório de ônibus...', filter);

      const { data, error } = await supabase
        .from('buses')
        .select(`
          id,
          plate,
          model,
          brand,
          status,
          created_at,
          routes (
            id,
            bookings (
              id,
              total_price,
              created_at
            )
          )
        `)
        .order('plate');

      if (error) throw error;

      return data?.map(bus => {
        // Calcular estatísticas baseadas nas rotas do ônibus
        let totalTrips = 0;
        let totalRevenue = 0;

        bus.routes?.forEach(route => {
          const filteredBookings = route.bookings?.filter(booking => 
            booking.created_at >= filter.startDate && booking.created_at <= filter.endDate
          ) || [];
          
          totalTrips += filteredBookings.length;
          totalRevenue += filteredBookings.reduce((sum, booking) => sum + (booking.total_price || 0), 0);
        });

        return {
          id: bus.id,
          plate: bus.plate,
          model: bus.model,
          brand: bus.brand,
          totalTrips,
          totalRevenue,
          maintenanceStatus: bus.status,
          lastMaintenance: undefined // TODO: Implementar quando houver tabela de manutenção
        };
      }) || [];

    } catch (error) {
      console.error('❌ Erro ao gerar relatório de ônibus:', error);
      throw error;
    }
  },

  // Resumo Geral dos Relatórios
  async getReportSummary(filter: ReportFilter): Promise<ReportSummary> {
    try {
      console.log('📈 Gerando resumo dos relatórios...', filter);

      const [salesData, routesData] = await Promise.all([
        this.getSalesReport(filter),
        this.getRoutesReport(filter)
      ]);

      const totalRevenue = salesData.reduce((sum, sale) => sum + sale.amount, 0);
      const totalBookings = salesData.length;
      const averageTicketValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

      // Encontrar rota com maior receita
      const topRoute = routesData.reduce((top, route) => 
        route.totalRevenue > (top?.totalRevenue || 0) ? route : top
      , routesData[0]);

      // Encontrar ônibus com maior receita
      const busesData = await this.getBusesReport(filter);
      const topBus = busesData.reduce((top, bus) => 
        bus.totalRevenue > (top?.totalRevenue || 0) ? bus : top
      , busesData[0]);

      return {
        totalRevenue,
        totalBookings,
        averageTicketValue,
        topRoute: topRoute ? `${topRoute.origin} → ${topRoute.destination}` : 'N/A',
        topBus: topBus ? `${topBus.brand} ${topBus.model} (${topBus.plate})` : 'N/A',
        period: `${new Date(filter.startDate).toLocaleDateString('pt-BR')} - ${new Date(filter.endDate).toLocaleDateString('pt-BR')}`
      };

    } catch (error) {
      console.error('❌ Erro ao gerar resumo dos relatórios:', error);
      throw error;
    }
  },

  // Exportar dados para CSV
  exportToCSV(data: any[], filename: string): void {
    try {
      if (!data || data.length === 0) {
        alert('Não há dados para exportar');
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escapar vírgulas e aspas
            return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

    } catch (error) {
      console.error('❌ Erro ao exportar CSV:', error);
      alert('Erro ao exportar arquivo CSV');
    }
  },

  // Utilitários
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  },

  getDateRange(period: 'today' | 'week' | 'month' | 'year'): ReportFilter {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        return {
          startDate: today.toISOString(),
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        return {
          startDate: weekStart.toISOString(),
          endDate: now.toISOString()
        };
      
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: monthStart.toISOString(),
          endDate: now.toISOString()
        };
      
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return {
          startDate: yearStart.toISOString(),
          endDate: now.toISOString()
        };
      
      default:
        return {
          startDate: today.toISOString(),
          endDate: now.toISOString()
        };
    }
  }
};