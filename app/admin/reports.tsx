import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  reportsService,
  ReportFilter,
  SalesReport,
  UsersReport,
  RoutesReport,
  BusesReport,
  ReportSummary,
} from '../../services/reportsService';

type ReportType = 'sales' | 'users' | 'routes' | 'buses' | 'summary';

interface ReportTab {
  id: ReportType;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function AdminReports() {
  const [activeTab, setActiveTab] = useState<ReportType>('summary');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Estados para diferentes tipos de relatórios
  const [salesData, setSalesData] = useState<SalesReport[]>([]);
  const [usersData, setUsersData] = useState<UsersReport[]>([]);
  const [routesData, setRoutesData] = useState<RoutesReport[]>([]);
  const [busesData, setBusesData] = useState<BusesReport[]>([]);
  const [summaryData, setSummaryData] = useState<ReportSummary | null>(null);

  const reportTabs: ReportTab[] = [
    { id: 'summary', title: 'Resumo', icon: 'analytics', color: '#8B5CF6' },
    { id: 'sales', title: 'Vendas', icon: 'card', color: '#10B981' },
    { id: 'users', title: 'Usuários', icon: 'people', color: '#F59E0B' },
    { id: 'routes', title: 'Rotas', icon: 'map', color: '#3B82F6' },
    { id: 'buses', title: 'Ônibus', icon: 'bus', color: '#EF4444' },
  ];

  useEffect(() => {
    console.log('Usuário acessou a página: Relatórios Administrativos');
    generateReport();
  }, [activeTab, filter]);

  const generateReport = async () => {
    try {
      setLoading(true);
      
      const reportFilter = {
        ...filter,
        startDate: filter.startDate + 'T00:00:00.000Z',
        endDate: filter.endDate + 'T23:59:59.999Z',
      };

      switch (activeTab) {
        case 'sales':
          const sales = await reportsService.getSalesReport(reportFilter);
          setSalesData(sales);
          break;
        case 'users':
          const users = await reportsService.getUsersReport(reportFilter);
          setUsersData(users);
          break;
        case 'routes':
          const routes = await reportsService.getRoutesReport(reportFilter);
          setRoutesData(routes);
          break;
        case 'buses':
          const buses = await reportsService.getBusesReport(reportFilter);
          setBusesData(buses);
          break;
        case 'summary':
          const summary = await reportsService.getReportSummary(reportFilter);
          setSummaryData(summary);
          break;
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      Alert.alert('Erro', 'Não foi possível gerar o relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      let data: any[] = [];
      let filename = '';

      switch (activeTab) {
        case 'sales':
          data = salesData;
          filename = 'relatorio_vendas';
          break;
        case 'users':
          data = usersData;
          filename = 'relatorio_usuarios';
          break;
        case 'routes':
          data = routesData;
          filename = 'relatorio_rotas';
          break;
        case 'buses':
          data = busesData;
          filename = 'relatorio_onibus';
          break;
        default:
          Alert.alert('Aviso', 'Este relatório não pode ser exportado');
          return;
      }

      if (data.length === 0) {
        Alert.alert('Aviso', 'Não há dados para exportar');
        return;
      }

      reportsService.exportToCSV(data, filename);
      Alert.alert('Sucesso', 'Relatório exportado com sucesso!');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível exportar o relatório');
    }
  };

  const setQuickDateRange = (period: 'today' | 'week' | 'month' | 'year') => {
    const range = reportsService.getDateRange(period);
    setFilter({
      startDate: range.startDate.split('T')[0],
      endDate: range.endDate.split('T')[0],
    });
  };

  const renderSummaryReport = () => {
    if (!summaryData) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: '#10B981' }]}>
            <Ionicons name="trending-up" size={24} color="#FFFFFF" />
            <Text style={styles.summaryValue}>
              {reportsService.formatCurrency(summaryData.totalRevenue)}
            </Text>
            <Text style={styles.summaryLabel}>Receita Total</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: '#3B82F6' }]}>
            <Ionicons name="ticket" size={24} color="#FFFFFF" />
            <Text style={styles.summaryValue}>{summaryData.totalBookings}</Text>
            <Text style={styles.summaryLabel}>Total de Reservas</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: '#8B5CF6' }]}>
            <Ionicons name="calculator" size={24} color="#FFFFFF" />
            <Text style={styles.summaryValue}>
              {reportsService.formatCurrency(summaryData.averageTicketValue)}
            </Text>
            <Text style={styles.summaryLabel}>Ticket Médio</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: '#F59E0B' }]}>
            <Ionicons name="calendar" size={24} color="#FFFFFF" />
            <Text style={styles.summaryValue}>30</Text>
            <Text style={styles.summaryLabel}>Dias</Text>
          </View>
        </View>

        <View style={styles.topPerformers}>
          <Text style={styles.sectionTitle}>Destaques do Período</Text>
          
          <View style={styles.performerItem}>
            <Ionicons name="map" size={20} color="#10B981" />
            <View style={styles.performerContent}>
              <Text style={styles.performerLabel}>Rota Mais Rentável</Text>
              <Text style={styles.performerValue}>{summaryData.topRoute}</Text>
            </View>
          </View>

          <View style={styles.performerItem}>
            <Ionicons name="bus" size={20} color="#3B82F6" />
            <View style={styles.performerContent}>
              <Text style={styles.performerLabel}>Ônibus Mais Rentável</Text>
              <Text style={styles.performerValue}>{summaryData.topBus}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderSalesReport = () => (
    <FlatList
      data={salesData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{item.route}</Text>
            <Text style={[styles.reportStatus, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
          <Text style={styles.reportSubtitle}>{item.passenger}</Text>
          <View style={styles.reportDetails}>
            <Text style={styles.reportDetail}>Data: {item.date}</Text>
            <Text style={styles.reportDetail}>Pagamento: {item.paymentMethod}</Text>
            <Text style={styles.reportAmount}>
              {reportsService.formatCurrency(item.amount)}
            </Text>
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderUsersReport = () => (
    <FlatList
      data={usersData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{item.name}</Text>
            <Text style={styles.reportBadge}>{item.totalBookings} reservas</Text>
          </View>
          <Text style={styles.reportSubtitle}>{item.email}</Text>
          <View style={styles.reportDetails}>
            <Text style={styles.reportDetail}>Telefone: {item.phone}</Text>
            <Text style={styles.reportDetail}>Cadastro: {item.registrationDate}</Text>
            <Text style={styles.reportAmount}>
              Total gasto: {reportsService.formatCurrency(item.totalSpent)}
            </Text>
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderRoutesReport = () => (
    <FlatList
      data={routesData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{item.origin} → {item.destination}</Text>
            <Text style={[styles.reportStatus, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
          <View style={styles.reportDetails}>
            <Text style={styles.reportDetail}>Reservas: {item.totalBookings}</Text>
            <Text style={styles.reportDetail}>Ocupação: {item.averageOccupancy}%</Text>
            <Text style={styles.reportAmount}>
              {reportsService.formatCurrency(item.totalRevenue)}
            </Text>
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
    />
  );

  const renderBusesReport = () => (
    <FlatList
      data={busesData}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.reportItem}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{item.brand} {item.model}</Text>
            <Text style={styles.reportBadge}>{item.plate}</Text>
          </View>
          <View style={styles.reportDetails}>
            <Text style={styles.reportDetail}>Viagens: {item.totalTrips}</Text>
            <Text style={styles.reportDetail}>Status: {item.maintenanceStatus}</Text>
            <Text style={styles.reportAmount}>
              {reportsService.formatCurrency(item.totalRevenue)}
            </Text>
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
    />
  );

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'active':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'cancelled':
      case 'inactive':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Gerando relatório...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'summary':
        return renderSummaryReport();
      case 'sales':
        return renderSalesReport();
      case 'users':
        return renderUsersReport();
      case 'routes':
        return renderRoutesReport();
      case 'buses':
        return renderBusesReport();
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Relatórios</Text>
        <Text style={styles.headerSubtitle}>Análise e estatísticas do sistema</Text>
      </LinearGradient>

      {/* Filtros de Data */}
      <View style={styles.filtersContainer}>
        <View style={styles.dateInputs}>
          <View style={styles.dateInput}>
            <Text style={styles.dateLabel}>Data Inicial</Text>
            <TextInput
              style={styles.input}
              value={filter.startDate}
              onChangeText={(text) => setFilter({ ...filter, startDate: text })}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={styles.dateInput}>
            <Text style={styles.dateLabel}>Data Final</Text>
            <TextInput
              style={styles.input}
              value={filter.endDate}
              onChangeText={(text) => setFilter({ ...filter, endDate: text })}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickFilters}>
          {['today', 'week', 'month', 'year'].map((period) => (
            <TouchableOpacity
              key={period}
              style={styles.quickFilterButton}
              onPress={() => setQuickDateRange(period as any)}
            >
              <Text style={styles.quickFilterText}>
                {period === 'today' ? 'Hoje' : 
                 period === 'week' ? 'Semana' :
                 period === 'month' ? 'Mês' : 'Ano'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tabs de Relatórios */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {reportTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { backgroundColor: tab.color }
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? '#FFFFFF' : tab.color}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && { color: '#FFFFFF' }
              ]}
            >
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Conteúdo do Relatório */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>

      {/* Botão de Exportar */}
      {activeTab !== 'summary' && (
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <Ionicons name="download" size={20} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Exportar CSV</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: -20,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateInputs: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  quickFilters: {
    flexDirection: 'row',
  },
  quickFilterButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  quickFilterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  tabsContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    color: '#6B7280',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  summaryContainer: {
    flex: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  summaryCard: {
    width: '47%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
    textAlign: 'center',
  },
  topPerformers: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  performerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  performerContent: {
    flex: 1,
    marginLeft: 12,
  },
  performerLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  performerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 2,
  },
  reportItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  reportStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reportBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#6B7280',
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  reportDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportDetail: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  reportAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});