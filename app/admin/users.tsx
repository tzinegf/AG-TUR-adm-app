import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
  Image,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { userService, type User, type UserSearchParams, type Booking } from '../../services/userService';

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tripSearchQuery, setTripSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'user' | 'admin' | 'manager' | 'driver'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');

  // Função para carregar usuários
  const loadUsers = async (pageNumber: number = 1, isRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const searchParams: UserSearchParams = {
        page: pageNumber,
        query: searchQuery,
        role: filterRole !== 'all' ? filterRole : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      };

      const result = await userService.searchUsers(searchParams);
      
      if (isRefresh) {
        setUsers(result.users);
      } else {
        setUsers(prev => [...prev, ...result.users]);
      }
      
      setHasMore(result.hasMore);
      setPage(pageNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar usuários iniciais
  useEffect(() => {
    loadUsers(1, true);
  }, []);

  // Recarregar quando os filtros mudarem
  useEffect(() => {
    loadUsers(1, true);
  }, [searchQuery, filterRole, filterStatus]);

  // Função para carregar mais usuários
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadUsers(page + 1);
    }
  };

  // Função para atualizar a lista
  const handleRefresh = () => {
    loadUsers(1, true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (user.cpf || '').includes(searchQuery) ||
      (user.phone || '').includes(searchQuery);
    
    const matchesTripSearch = tripSearchQuery === '' || 
      (user.bookings && user.bookings.some(booking => 
        (booking.routeName?.toLowerCase() || '').includes(tripSearchQuery.toLowerCase()) ||
        (booking.bookingCode?.toLowerCase() || '').includes(tripSearchQuery.toLowerCase())
      ));
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    
    return matchesSearch && matchesTripSearch && matchesRole && matchesStatus;
  });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    cpf: '',
    role: 'user' as 'user' | 'admin' | 'manager' | 'driver',
    status: 'active' as 'active' | 'inactive' | 'suspended',
    emailVerified: false,
    phoneVerified: false,
  });

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      cpf: '',
      role: 'user',
      status: 'active',
      emailVerified: false,
      phoneVerified: false,
    });
    setModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
      cpf: user.cpf,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    });
    setModalVisible(true);
  };

  const handleViewDetails = async (user: User) => {
    try {
      setLoading(true);
      const userDetails = await userService.getUserById(user.id);
      setSelectedUser(userDetails);
      setDetailsModalVisible(true);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes do usuário');
      console.error('Erro ao carregar detalhes do usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = (userId: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await userService.updateUserStatus(userId, 'inactive');
              Alert.alert('Sucesso', 'Usuário excluído com sucesso!');
              handleRefresh();
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível excluir o usuário');
              console.error('Erro ao excluir usuário:', err);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveUser = async () => {
    if (!formData.name || !formData.email || !formData.cpf) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      
      if (editingUser) {
        await userService.updateUser(editingUser.id, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        Alert.alert('Sucesso', 'Usuário atualizado com sucesso!');
      } else {
        await userService.createUser({
          ...formData,
          createdAt: new Date().toISOString(),
          lastLogin: '-',
          totalBookings: 0,
          totalSpent: 0,
        });
        Alert.alert('Sucesso', 'Usuário cadastrado com sucesso!');
      }

      setModalVisible(false);
      handleRefresh();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar o usuário');
      console.error('Erro ao salvar usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = (user: User) => {
    Alert.alert(
      'Resetar Senha',
      `Enviar email de redefinição de senha para ${user.email}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            try {
              setLoading(true);
              await userService.resetPassword(user.email);
              Alert.alert('Sucesso', 'Email de redefinição de senha enviado!');
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível enviar o email de redefinição de senha');
              console.error('Erro ao resetar senha:', err);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'inactive': return '#6B7280';
      case 'suspended': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'user': return 'Usuário';
      case 'admin': return 'Administrador';
      case 'manager': return 'Gerente';
      case 'driver': return 'Motorista';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#DC2626';
      case 'manager': return '#7C3AED';
      case 'driver': return '#2563EB';
      case 'user': return '#059669';
      default: return '#6B7280';
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getBookingStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendente';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => handleViewDetails(item)}>
      <View style={styles.userHeader}>
        <Image 
          source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.name}&background=DC2626&color=fff` }} 
          style={styles.userAvatar} 
        />
        <View style={styles.userInfo}>
          <View style={styles.userTopRow}>
            <Text style={styles.userName}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>
                {item.status === 'active' ? 'Ativo' : item.status === 'inactive' ? 'Inativo' : 'Suspenso'}
              </Text>
            </View>
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userDetails}>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
              <Text style={styles.roleText}>{getRoleLabel(item.role)}</Text>
            </View>
            <View style={styles.verificationIcons}>
              {item.emailVerified && (
                <Ionicons name="mail-outline" size={14} color="#10B981" />
              )}
              {item.phoneVerified && (
                <Ionicons name="call-outline" size={14} color="#10B981" />
              )}
            </View>
          </View>
          {item.role === 'user' && (
            <View style={styles.userStats}>
              <Text style={styles.statText}>
                <Text style={styles.statLabel}>Reservas:</Text> {item.totalBookings || 0}
              </Text>
              <Text style={styles.statText}>
                <Text style={styles.statLabel}>Total:</Text> R$ {(item.totalSpent || 0).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditUser(item)}
        >
          <Ionicons name="pencil" size={20} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleResetPassword(item)}
        >
          <Ionicons name="key" size={20} color="#F59E0B" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteUser(item.id)}
        >
          <Ionicons name="trash" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Usuários</Text>
      </View>
      
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="people" size={24} color="#F59E0B" />
          </View>
          <Text style={styles.statValue}>{users.length}</Text>
          <Text style={styles.statLabel}>Total de Usuários</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>
            {users.filter(u => u.status === 'active').length}
          </Text>
          <Text style={styles.statLabel}>Usuários Ativos</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Ionicons name="person" size={24} color="#3B82F6" />
          </View>
          <Text style={styles.statValue}>
            {users.filter(u => u.role === 'user').length}
          </Text>
          <Text style={styles.statLabel}>Clientes</Text>
        </View>
      </View>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuários..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      
        <View style={styles.filtersContainer}>
          <Picker
            selectedValue={filterRole}
            onValueChange={setFilterRole}
            style={styles.filterPicker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="Todos os papéis" value="all" />
            <Picker.Item label="Usuários" value="user" />
            <Picker.Item label="Administradores" value="admin" />
            <Picker.Item label="Gerentes" value="manager" />
            <Picker.Item label="Motoristas" value="driver" />
          </Picker>
      
          <Picker
            selectedValue={filterStatus}
            onValueChange={setFilterStatus}
            style={styles.filterPicker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="Todos os status" value="all" />
            <Picker.Item label="Ativos" value="active" />
            <Picker.Item label="Inativos" value="inactive" />
            <Picker.Item label="Suspensos" value="suspended" />
          </Picker>
        </View>
      </View>
      
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={item => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshing={loading}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.listContainer}
      />

      {/* Rest of the component (modals, etc.) */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'space-between',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#1F2937',
  },
  filtersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
    paddingHorizontal: 4,
    minHeight: 60,
  },
  filterPicker: {
    flex: 1,
    height: 56,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 16,
    color: '#1F2937',
    fontSize: 14,
    justifyContent: 'center',
  },
  pickerItem: {
    fontSize: 14,
    height: 56,
    color: '#1F2937',
    backgroundColor: '#F3F4F6',
    textAlign: 'left',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  userHeader: {
    flexDirection: 'row',
    padding: 16,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  verificationIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  userStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  userActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  pickerContainer: {
     borderWidth: 1,
     borderColor: '#D1D5DB',
     borderRadius: 12,
     overflow: 'hidden',
     minHeight: 56,
   },
   formPicker: {
     height: 56,
   },
  verificationSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  switchLabel: {
    fontSize: 16,
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  detailsAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  detailsName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
  },
  verifiedText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: 8,
  },
  statBoxLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 20,
  },
  detailActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  detailActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tripHistoryContainer: {
    marginTop: 16,
  },
  tripCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  tripStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tripStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tripDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tripInfo: {
    flex: 1,
  },
  tripLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  tripValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  tripPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  noTripsText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  bookingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  bookingCode: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  bookingStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bookingStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bookingDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  bookingDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingDetailText: {
    fontSize: 14,
    color: '#4B5563',
  },
});
