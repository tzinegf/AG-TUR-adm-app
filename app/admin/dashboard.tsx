import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { dashboardService, DashboardStats, RecentActivity } from '../../services/dashboard';
import { adminAuthService, type AdminUser } from '../../services/adminAuth';
import { couponsService } from '../../services/coupons';

interface DashboardCard {
  id: string;
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
}

export default function AdminDashboard() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalBookings: 0,
    activeRoutes: 0,
    totalBuses: 0,
    totalUsers: 0,
    todayRevenue: 0,
    monthRevenue: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [activeCoupons, setActiveCoupons] = useState(0);

  const dashboardCards: DashboardCard[] = [
    {
      id: '1',
      title: 'Rotas',
      value: stats.activeRoutes.toString(),
      icon: 'map',
      color: '#10B981',
      route: '/admin/routes',
    },
    {
      id: '2',
      title: 'Ônibus',
      value: stats.totalBuses.toString(),
      icon: 'bus',
      color: '#3B82F6',
      route: '/admin/buses',
    },
    {
      id: '3',
      title: 'Reservas',
      value: stats.totalBookings.toString(),
      icon: 'ticket',
      color: '#8B5CF6',
      route: '/admin/bookings',
    },
    {
      id: '4',
      title: 'Usuários',
      value: stats.totalUsers.toString(),
      icon: 'people',
      color: '#F59E0B',
      route: '/admin/users',
    },
    {
      id: '5',
      title: 'Cupons',
      value: activeCoupons.toString(),
      icon: 'pricetag',
      color: '#F59E0B',
      route: '/admin/coupons',
    },
  ];

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardStats, activities, couponsActive] = await Promise.all([
        dashboardService.getDashboardStats(),
        dashboardService.getRecentActivities(),
        couponsService.getActiveCount(),
      ]);
      
      setStats(dashboardStats);
      setRecentActivities(activities);
      setActiveCoupons(couponsActive || 0);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('📊 Usuário acessou a página: Dashboard Administrativo');
    // Fetch current admin user
    adminAuthService.getCurrentAdminUser().then(setAdminUser).catch(() => setAdminUser(null));
    fetchDashboardData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await adminAuthService.signOutAdmin();
    router.replace('/');
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#DC2626', '#B91C1C']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>Bem-vindo,</Text>
            <Text style={styles.adminName}>{adminUser?.name}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Revenue Cards */}
      <View style={styles.revenueContainer}>
        <View style={styles.revenueCard}>
          <Ionicons name="cash" size={24} color="#10B981" />
          <Text style={styles.revenueLabel}>Receita Hoje</Text>
          <Text style={styles.revenueValue}>{dashboardService.formatCurrency(stats.todayRevenue)}</Text>
        </View>
        <View style={styles.revenueCard}>
          <Ionicons name="trending-up" size={24} color="#3B82F6" />
          <Text style={styles.revenueLabel}>Receita Mensal</Text>
          <Text style={styles.revenueValue}>{dashboardService.formatCurrency(stats.monthRevenue)}</Text>
        </View>
      </View>

      {/* Dashboard Cards */}
      <View style={styles.cardsContainer}>
        {dashboardCards.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.card}
            onPress={() => router.push(card.route as any)}
          >
            <View style={[styles.cardIcon, { backgroundColor: card.color }]}>
              <Ionicons name={card.icon} size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.cardValue}>{card.value}</Text>
            <Text style={styles.cardTitle}>{card.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/admin/routes')}>
          <Ionicons name="add-circle" size={24} color="#DC2626" />
          <Text style={styles.actionText}>Nova Rota</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/admin/buses')}>
          <Ionicons name="bus" size={24} color="#DC2626" />
          <Text style={styles.actionText}>Cadastrar Ônibus</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/admin/reports')}>
          <Ionicons name="analytics" size={24} color="#DC2626" />
          <Text style={styles.actionText}>Gerar Relatório</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      <View style={styles.recentActivity}>
        <Text style={styles.sectionTitle}>Atividade Recente</Text>
        
        {loading ? (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="time" size={20} color="#9CA3AF" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>Carregando atividades...</Text>
              <Text style={styles.activityTime}>Aguarde</Text>
            </View>
          </View>
        ) : recentActivities.length > 0 ? (
          recentActivities.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Ionicons name={activity.icon as any} size={20} color={activity.color} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>{activity.description}</Text>
                <Text style={styles.activityTime}>{dashboardService.formatTimeAgo(activity.timestamp)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Ionicons name="information-circle" size={20} color="#9CA3AF" />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityText}>Nenhuma atividade recente</Text>
              <Text style={styles.activityTime}>Aguardando movimentação</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  adminName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  revenueContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: -20,
    gap: 16,
  },
  revenueCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  revenueLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  revenueValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 4,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 16,
  },
  card: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  cardTitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  quickActions: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
  },
  recentActivity: {
    paddingHorizontal: 20,
    marginTop: 32,
    marginBottom: 32,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 16,
    color: '#1F2937',
  },
  activityTime: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
