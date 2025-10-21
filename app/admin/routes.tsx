import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { mask } from 'react-native-mask-text';
import { busRoutesService, type BusRoute } from '../../services/busRoutes';
import { busService } from '../../services/busService';
import { userService } from '../../services/userService';

// Máscaras separadas para data e hora
const applyDateMask = (value: string) => {
  const numericValue = value.replace(/[^\d]/g, '');
  return mask(numericValue, '99/99/9999');
};

const applyTimeMask = (value: string) => {
  const numericValue = value.replace(/[^\d]/g, '');
  return mask(numericValue, '99:99');
};

// Função para calcular duração em tempo real
const calculateDurationRealTime = (departure: string, arrival: string): string => {
  if (!departure || !arrival) return '';
  
  try {
    const departureDateTime = parseDateTime(departure);
    const arrivalDateTime = parseDateTime(arrival);
    
    if (departureDateTime && arrivalDateTime) {
      const durationMs = arrivalDateTime.getTime() - departureDateTime.getTime();
      
      if (durationMs <= 0) return '';
      
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        return `${hours}h ${minutes}min`;
      } else {
        return `${minutes}min`;
      }
    }
  } catch (error) {
    return '';
  }
  
  return '';
};
const parseDateTime = (dateTimeString: string): Date | null => {
  const fullDateTimeRegex = /^(\d{2})\/(\d{2})\/(\d{4})\s(\d{2}):(\d{2})$/;
  const timeOnlyRegex = /^(\d{1,2}):(\d{2})$/;
  
  if (fullDateTimeRegex.test(dateTimeString)) {
    const match = dateTimeString.match(fullDateTimeRegex);
    if (match) {
      const [, day, month, year, hour, minute] = match;
      // Mês em JavaScript é 0-indexado (0 = Janeiro, 11 = Dezembro)
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
  }
  
  if (timeOnlyRegex.test(dateTimeString)) {
    const match = dateTimeString.match(timeOnlyRegex);
    if (match) {
      const [, hour, minute] = match;
      // Se for apenas hora, usa a próxima ocorrência (hoje se ainda futuro; caso contrário, amanhã)
      const h = parseInt(hour, 10);
      const m = parseInt(minute, 10);
      const now = new Date();
      const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      if (candidate.getTime() <= now.getTime()) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    }
  }
  
  return null;
};

// Compor "DD/MM/AAAA" + "HH:MM" em "DD/MM/AAAA HH:MM"
const composeDateTime = (dateStr: string, timeStr: string): string => {
  const d = (dateStr || '').trim();
  const t = (timeStr || '').trim();
  return d && t ? `${d} ${t}` : '';
};


// Converter "DD/MM/AAAA HH:MM" para formato SQL "YYYY-MM-DD HH:MM"
const toSQLDateTime = (dateTimeStr: string): string => {
  const dt = parseDateTime(dateTimeStr);
  if (!dt) return dateTimeStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = dt.getFullYear();
  const mm = pad(dt.getMonth() + 1);
  const dd = pad(dt.getDate());
  const hh = pad(dt.getHours());
  const min = pad(dt.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
};
const toDateSafe = (input: string): Date | null => {
  if (!input) return null;
  // 1) Tenta via parseDateTime (cobre "DD/MM/AAAA HH:MM" e apenas hora "HH:MM")
  const parsed = parseDateTime(input);
  if (parsed) return parsed;
  // 2) Tenta Date direto
  const direct = new Date(input);
  if (!isNaN(direct.getTime())) return direct;
  // 3) Normaliza para ISO (YYYY-MM-DDTHH:MM(:SS))
  const normalized = input.includes(' ') ? input.replace(' ', 'T') : input;
  const withSeconds = /T\d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized;
  const d2 = new Date(withSeconds);
  if (!isNaN(d2.getTime())) return d2;
  // 4) Tenta separar em { date, time } e montar
  const { date, time } = splitDateTime(input);
  if (date && time) {
    const [day, month, year] = date.split('/').map(v => parseInt(v, 10));
    const [hour, minute] = time.split(':').map(v => parseInt(v, 10));
    const d3 = new Date(year, month - 1, day, hour, minute);
    if (!isNaN(d3.getTime())) return d3;
  }
  return null;
};
const splitDateTime = (dateTimeString: string): { date: string; time: string } => {
  const input = (dateTimeString || '').trim();
  // Formato brasileiro: DD/MM/AAAA HH:MM
  const brazilRegex = /^(\d{2}\/\d{2}\/\d{4})\s(\d{2}:\d{2})$/;
  const brazilMatch = input.match(brazilRegex);
  if (brazilMatch) {
    return { date: brazilMatch[1], time: brazilMatch[2] };
  }
  // Formato SQL/ISO: YYYY-MM-DD[ T]HH:MM(:SS)?(Z|±HH:MM)?
  const isoRegex = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/;
  const isoMatch = input.match(isoRegex);
  if (isoMatch) {
    const [, y, m, d, h, mi] = isoMatch;
    return { date: `${d}/${m}/${y}`, time: `${h}:${mi}` };
  }
  // Tentativa com Date parser
  const dt = new Date(input);
  if (!isNaN(dt.getTime())) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      date: `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`,
      time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    };
  }
  return { date: '', time: '' };
};

// Validações separadas de Data e Hora
const validateBrazilianDate = (dateString: string): boolean => {
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = (dateString || '').match(dateRegex);
  if (!match) return false;
  const [, day, month, year] = match;
  const dayNum = parseInt(day);
  const monthNum = parseInt(month);
  const yearNum = parseInt(year);
  if (dayNum < 1 || dayNum > 31) return false;
  if (monthNum < 1 || monthNum > 12) return false;
  if (yearNum < 2024 || yearNum > 2035) return false;
  return true;
};

const validateBrazilianTime = (timeString: string): boolean => {
  const timeRegex = /^(\d{2}):(\d{2})$/;
  const match = (timeString || '').match(timeRegex);
  if (!match) return false;
  const [, hour, minute] = match;
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);
  if (hourNum < 0 || hourNum > 23) return false;
  if (minuteNum < 0 || minuteNum > 59) return false;
  return true;
};

interface RouteDisplay {
  id: string;
  origin: string;
  destination: string;
  duration: string;
  distance: string;
  price: string;
  active: boolean;
  departure: string;
  arrival: string;
  bus_type: string;
  bus_company: string;
  // motorista vinculado
  driver_id?: string;
  // segundo motorista vinculado (opcional)
  second_driver_id?: string;
  // ônibus vinculado
  bus_id?: string;
}

export default function RoutesManagement() {
  const router = useRouter();
  const [routes, setRoutes] = useState<RouteDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalVisible, setModalVisible] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteDisplay | null>(null);
  
  // Lista de motoristas
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driversError, setDriversError] = useState<string | null>(null);
  
  // Lista de ônibus
  const [buses, setBuses] = useState<{ id: string; plate: string; model: string; type: string }[]>([]);
  const [busesLoading, setBusesLoading] = useState(false);
  const [busesError, setBusesError] = useState<string | null>(null);
  const [allBusesMap, setAllBusesMap] = useState<Record<string, { plate: string; model: string; type: string; seats?: number }>>({});
  // Helpers para normalizar tipo de ônibus e capacidade padrão
  const formatBusTypeForDB = (type: string) => {
    const t = (type || '').toLowerCase().trim();
    if (t === 'convencional') return 'convencional';
    if (t === 'executivo') return 'executivo';
    // Mapear semi-leito para leito, pois o banco não possui semi-leito
    if (t === 'semi-leito' || t === 'semileito' || t === 'semi leito') return 'leito';
    if (t === 'leito') return 'leito';
    return 'convencional';
  };
  
  const getCapacityByBusType = (type: string) => {
    switch (type) {
      case 'executivo':
        return 46;
      case 'leito':
        return 32;
      case 'convencional':
      default:
        return 42;
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departureDate: '',
    departureTime: '',
    arrivalDate: '',
    arrivalTime: '',
    price: '',
    bus_company: 'AG TUR',
    bus_type: 'convencional',
    amenities: [],
    driverId: '',
    secondDriverId: '',
    busId: ''
  });

  // Fetch routes on component mount
  useEffect(() => {
    console.log('Usuário acessou a página: Rotas Administrativas');
    fetchRoutes();
  }, []);

  // Carregar motoristas ativos
  useEffect(() => {
    const loadDrivers = async () => {
      try {
        setDriversLoading(true);
        setDriversError(null);
        const res = await userService.searchUsers({ role: 'driver', status: 'active', limit: 100 });
        const list = (res.users || []).map(u => ({ id: u.id, name: u.name || u.email }));
        setDrivers(list);
      } catch (err) {
        console.error('Erro ao carregar motoristas:', err);
        setDriversError('Falha ao carregar motoristas');
      } finally {
        setDriversLoading(false);
      }
    };
    loadDrivers();
  }, []);

  // Carregar ônibus disponíveis
  useEffect(() => {
    const loadBuses = async () => {
      try {
        setBusesLoading(true);
        setBusesError(null);
        const availableBuses = await busService.getAvailableBuses();
        const busList = availableBuses.map(bus => ({ 
          id: bus.id, 
          plate: bus.plate, 
          model: bus.model,
          type: bus.type 
        }));
        setBuses(busList);
      } catch (err) {
        console.error('Erro ao carregar ônibus:', err);
        setBusesError('Falha ao carregar ônibus');
      } finally {
        setBusesLoading(false);
      }
    };
    loadBuses();
  }, []);

  // Carregar todos os ônibus (ativos e inativos) para exibição correta nos cards
  useEffect(() => {
    const loadAllBusesForCards = async () => {
      try {
        const allBuses = await busService.getAllBuses();
        const map = allBuses.reduce((acc, bus) => {
          acc[bus.id] = { plate: bus.plate, model: bus.model, type: bus.type, seats: bus.seats };
          return acc;
        }, {} as Record<string, { plate: string; model: string; type: string; seats?: number }>);
        setAllBusesMap(map);
      } catch (err) {
        console.error('Erro ao carregar todos os ônibus para cards:', err);
      }
    };
    loadAllBusesForCards();
  }, []);

  // Fetch all routes from API
  const fetchRoutes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the new getAllRoutes function from busRoutesService
      const routesData = await busRoutesService.getAllRoutes();
      const nowMs = Date.now();
      const futureRoutes: BusRoute[] = (routesData || []).filter((route: BusRoute) => {
         const dt = toDateSafe((route as any).departure_datetime);
         return dt ? dt.getTime() > nowMs : false;
       });
      
       if (futureRoutes.length) {
        const formattedRoutes: RouteDisplay[] = futureRoutes.map((route: BusRoute) => ({
          id: String(route.id),
          origin: route.origin,
          destination: route.destination,
          departure: (route as any).departure_datetime,
          arrival: (route as any).arrival_datetime,
          duration: route.duration || 'N/A',
          distance: '~',
          price: `R$ ${String((route.price ?? 0).toFixed(2)).replace('.', ',')}`,
          active: route.status === 'active',
          bus_company: route.bus_company || 'AG TUR',
          bus_type: route.bus_type || 'Convencional',
          driver_id: (route as any).driver_id || '',
          second_driver_id: (route as any).second_driver_id || '',
          bus_id: (route as any).bus_id || ''
        }));
         setRoutes(formattedRoutes);
       } else {
         setRoutes([]);
       }
    } catch (err) {
      setError('Falha ao carregar rotas');
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate duration between departure and arrival in minutes for database
  const calculateDurationInMinutes = (departure: string, arrival: string): number => {
    const departureDate = parseDateTime(departure);
    const arrivalDate = parseDateTime(arrival);
    
    if (!departureDate || !arrivalDate) {
      return 0;
    }
    
    const diffInMinutes = Math.floor((arrivalDate.getTime() - departureDate.getTime()) / 60000);
    return diffInMinutes > 0 ? diffInMinutes : 0;
  };

  // Calculate duration between departure and arrival
  const calculateDuration = (departure: string, arrival: string) => {
    const departureDate = new Date(departure);
    const arrivalDate = new Date(arrival);
    const diffInMinutes = Math.floor((arrivalDate.getTime() - departureDate.getTime()) / 60000);
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    return `${hours}h ${minutes > 0 ? minutes + 'min' : ''}`;
  };
  // Form handlers
  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData({ ...formData, [field]: value });
  };

  const toggleModal = () => {
    if (isModalVisible) {
      // Fechando modal - limpar formulário
      setFormData({
        origin: '',
        destination: '',
        departureDate: '',
        departureTime: '',
        arrivalDate: '',
        arrivalTime: '',
        price: '',
        bus_company: 'AG TUR',
        bus_type: 'convencional',
        amenities: [],
        driverId: '',
        busId: ''
      });
      setEditingRoute(null);
    }
    setModalVisible(!isModalVisible);
  };

  const handleCancel = () => {
    // Verificar se há dados preenchidos no formulário
    const hasData = formData.origin || formData.destination || formData.departureDate ||
                   formData.departureTime || formData.arrivalDate || formData.arrivalTime ||
                   formData.price || formData.bus_company;
    
    if (hasData) {
      Alert.alert(
        'Cancelar Edição',
        'Você tem alterações não salvas. Deseja realmente cancelar?',
        [
          {
            text: 'Continuar Editando',
            style: 'cancel',
          },
          {
            text: 'Sim, Cancelar',
            style: 'destructive',
            onPress: () => {
              // Limpar o formulário antes de fechar
              setFormData({
                origin: '',
                destination: '',
                departureDate: '',
                departureTime: '',
                arrivalDate: '',
                arrivalTime: '',
                price: '',
                bus_company: 'AG TUR',
                bus_type: 'convencional',
                amenities: [],
                driverId: '',
                busId: ''
              });
              setEditingRoute(null);
              toggleModal();
            },
          },
        ]
      );
    } else {
      // Limpar o formulário e fechar modal
      setFormData({
        origin: '',
        destination: '',
        departureDate: '',
        departureTime: '',
        arrivalDate: '',
        arrivalTime: '',
        price: '',
        bus_company: 'AG TUR',
        bus_type: 'convencional',
        amenities: [],
        driverId: '',
        busId: ''
      });
      setEditingRoute(null);
      toggleModal();
    }
  };



  const handleAddRoute = async () => {
    try {
      // Validação de campos obrigatórios
      if (!formData.origin?.trim()) {
        Alert.alert('Erro de Validação', 'Por favor, informe a cidade de origem');
        return;
      }

      if (!formData.destination?.trim()) {
        Alert.alert('Erro de Validação', 'Por favor, informe a cidade de destino');
        return;
      }

      if (!formData.departureDate?.trim() || !formData.departureTime?.trim()) {
        Alert.alert('Erro de Validação', 'Por favor, informe data e hora de partida');
        return;
      }

      if (!formData.arrivalDate?.trim() || !formData.arrivalTime?.trim()) {
        Alert.alert('Erro de Validação', 'Por favor, informe data e hora de chegada');
        return;
      }

      if (!formData.price?.trim()) {
        Alert.alert('Erro de Validação', 'Por favor, informe o preço da passagem');
        return;
      }

      if (!formData.bus_company?.trim()) {
        Alert.alert('Erro de Validação', 'Por favor, informe a empresa do ônibus');
        return;
      }

      // Motorista é obrigatório ao cadastrar nova rota
      if (!editingRoute && (!formData.driverId || !formData.driverId.trim())) {
        Alert.alert('Erro de Validação', 'Por favor, selecione um motorista');
        return;
      }
      
      // Limpar segundo motorista se ficar igual ao primeiro
      useEffect(() => {
        if (formData.secondDriverId && formData.secondDriverId === formData.driverId) {
          setFormData(prev => ({ ...prev, secondDriverId: '' }));
        }
      }, [formData.driverId, formData.secondDriverId]);
      // Segundo motorista opcional: se preenchido, não pode ser igual ao primeiro
      if (formData.secondDriverId && formData.secondDriverId === formData.driverId) {
        Alert.alert('Erro de Validação', 'O segundo motorista não pode ser o mesmo que o primeiro');
        return;
      }

      const toHHMMSS = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      const newRoute = {
        origin: formData.origin.trim(),
        destination: formData.destination.trim(),
        departure_datetime: departureDateTime!.toISOString(),
        arrival_datetime: arrivalDateTime!.toISOString(),
        // Legacy time-only fields for compatibility with older schemas
        departure: toHHMMSS(departureDateTime!),
        arrival: toHHMMSS(arrivalDateTime!),
        departure_time: toHHMMSS(departureDateTime!),
        arrival_time: toHHMMSS(arrivalDateTime!),
        price: finalPrice,
        bus_company: formData.bus_company.trim(),
        bus_type: normalizedBusTypeForDB,
        
        duration: calculateDurationRealTime(departureCombined, arrivalCombined),
        status: 'active' as 'active',
        available_seats: capacity,
        // Vinculação do motorista
        driver_id: formData.driverId || undefined,
        // Segundo motorista vinculado (opcional)
        second_driver_id: formData.secondDriverId || undefined,
        // Vinculação do ônibus
        bus_id: effectiveBusId
      };

      if (editingRoute) {
        // Update existing route
        await busRoutesService.updateRoute(editingRoute.id, newRoute);
        Alert.alert('Sucesso', 'Rota atualizada com sucesso');
      } else {
        // Create new route
        await busRoutesService.createRoute(newRoute);
        Alert.alert('Sucesso', 'Rota cadastrada com sucesso');
      }

      // Refresh routes list
      await fetchRoutes();
      toggleModal();
    } catch (err) {
      console.error('Error saving route:', err);
      Alert.alert('Erro', `Falha ao ${editingRoute ? 'atualizar' : 'cadastrar'} rota`);
    }
  };

  const handleEditRoute = (route: RouteDisplay) => {
    const { departure, arrival } = route;
    const dep = splitDateTime(departure);
    const arr = splitDateTime(arrival);

    const priceValue = route.price.replace('R$ ', '').trim();

    setFormData({
      origin: route.origin,
      destination: route.destination,
      departureDate: dep.date,
      departureTime: dep.time,
      arrivalDate: arr.date,
      arrivalTime: arr.time,
      price: priceValue,
      bus_company: route.bus_company,
      bus_type: route.bus_type || 'convencional',
      amenities: [],
      driverId: (route as any).driver_id || '',
      secondDriverId: '',
      busId: (route as any).bus_id || ''
    });
    setEditingRoute(route);
    setModalVisible(true);
  };

  const toggleRouteStatus = async (routeId: string, currentStatus: boolean) => {
    try {
      await busRoutesService.updateRoute(routeId, {
        status: currentStatus ? 'inactive' : 'active'
      });
      await fetchRoutes();
      Alert.alert('Sucesso', 'Status da rota atualizado com sucesso');
    } catch (err) {
      console.error('Error updating route status:', err);
      Alert.alert('Erro', 'Falha ao atualizar status da rota');
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir esta rota?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              await busRoutesService.deleteRoute(routeId);
              await fetchRoutes();
              Alert.alert('Sucesso', 'Rota excluída com sucesso');
            } catch (err) {
              console.error('Error deleting route:', err);
              Alert.alert('Erro', 'Falha ao excluir rota');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Actions */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Gerenciar Rotas</Text>
        </View>
        
        <TouchableOpacity style={styles.addButton} onPress={toggleModal}>
          <Ionicons name="add-circle" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Nova Rota</Text>
        </TouchableOpacity>
      </View>

      {/* Routes List */}
      <ScrollView style={styles.routesList}>
        {loading ? (
          <ActivityIndicator size="large" color="#DC2626" style={{marginTop: 20}} />
        ) : error ? (
          <View style={{alignItems: 'center', marginTop: 20}}>
            <Text style={{color: '#EF4444', marginBottom: 10}}>{error}</Text>
            <TouchableOpacity onPress={fetchRoutes}>
              <Text style={{color: '#3B82F6'}}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : routes.length === 0 ? (
          <Text style={{textAlign: 'center', marginTop: 20, color: '#6B7280'}}>
            Nenhuma rota encontrada. Adicione uma nova rota para começar.
          </Text>
        ) : (
          routes.map((route) => (
            <View key={route.id} style={styles.routeCard}>
              <View style={styles.routeHeader}>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeTitle}>
                    {route.origin} → {route.destination}
                  </Text>
                  <View style={styles.routeDetails}
>
                    <View style={styles.detailItem}
>
                      <Ionicons name="time" size={16} color="#6B7280" />
                      <Text style={styles.detailText}>{route.duration}</Text>
                    </View>
                    <View style={styles.detailItem}
>
                      <Ionicons name="bus" size={16} color="#6B7280" />
                      <Text style={styles.detailText}>{(() => {
                        const b = route.bus_id ? allBusesMap[route.bus_id] : undefined;
                        const type = b?.type ?? route.bus_type;
                        return formatBusTypeForDisplay(type);
                      })()}</Text>
                    </View>
                    <View style={styles.detailItem}
>
                      <Ionicons name="bus" size={16} color="#6B7280" />
                      <Text style={styles.detailText}>{(() => {
                        const b = route.bus_id ? allBusesMap[route.bus_id] : undefined;
                        return b ? `${b.plate} - ${b.model}` : 'Sem ônibus vinculado';
                      })()}</Text>
                    </View>
                    <View style={styles.detailItem}
>
                      <Ionicons name="people" size={16} color="#6B7280" />
                      <Text style={styles.detailText}>{(() => {
                        const b = route.bus_id ? allBusesMap[route.bus_id] : undefined;
                        const cap = b?.seats ?? route.available_seats ?? getCapacityByBusType(route.bus_type);
                        return `${cap} lugares`;
                      })()}</Text>
                    </View>
                    <View style={styles.detailItem}
>
                      <Ionicons name="cash" size={16} color="#6B7280" />
                      <Text style={styles.detailText}>{route.price}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.statusBadge, route.active ? styles.activeBadge : styles.inactiveBadge]}>
                  <Text style={styles.statusText}>{route.active ? 'Ativa' : 'Inativa'}</Text>
                </View>
              </View>

              <View style={styles.routeActions}>
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => toggleRouteStatus(route.id, route.active)}
                >
                  <Ionicons 
                    name={route.active ? "pause-circle" : "play-circle"} 
                    size={20} 
                    color={route.active ? "#F59E0B" : "#10B981"} 
                  />
                  <Text style={styles.actionText}>
                    {route.active ? 'Desativar' : 'Ativar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleEditRoute(route)}
                >
                  <Ionicons name="create" size={20} color="#3B82F6" />
                  <Text style={styles.actionText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleDeleteRoute(route.id)}
                >
                  <Ionicons name="trash" size={20} color="#EF4444" />
                  <Text style={styles.actionText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Route Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={toggleModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={toggleModal}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {editingRoute ? 'Editar Rota' : 'Nova Rota'}
            </Text>

          <ScrollView 
            style={styles.modalBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formGroup}>
              <Text style={styles.label}>Origem *</Text>
              <TextInput
                style={styles.input}
                value={formData.origin}
                onChangeText={(text) => handleInputChange('origin', text)}
                placeholder="Ex: São Paulo"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Destino *</Text>
              <TextInput
                style={styles.input}
                value={formData.destination}
                onChangeText={(text) => handleInputChange('destination', text)}
                placeholder="Ex: Rio de Janeiro"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Data de Partida *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.departureDate}
                  onChangeText={(text) => {
                    const masked = applyDateMask(text);
                    handleInputChange('departureDate', masked);
                  }}
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                  maxLength={10}
                />
                <View style={{ height: 8 }} />
                 <Text style={styles.label}>Data de Chegada *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.arrivalDate}
                  onChangeText={(text) => {
                    const masked = applyDateMask(text);
                    handleInputChange('arrivalDate', masked);
                  }}
                  placeholder="DD/MM/AAAA"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Hora de Partida *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.departureTime}
                  onChangeText={(text) => {
                    const masked = applyTimeMask(text);
                    handleInputChange('departureTime', masked);
                  }}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                  maxLength={5}
                />
               
                <View style={{ height: 8 }} />
                <Text style={styles.label}>Hora de Chegada *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.arrivalTime}
                  onChangeText={(text) => {
                    const masked = applyTimeMask(text);
                    handleInputChange('arrivalTime', masked);
                  }}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Duração da Viagem</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#F9FAFB', color: '#6B7280' }]}
                value={calculateDurationRealTime(
                  composeDateTime(formData.departureDate, formData.departureTime),
                  composeDateTime(formData.arrivalDate, formData.arrivalTime)
                )}
                editable={false}
                placeholder="Calculado automaticamente"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Preço *</Text>
              <TextInput
                style={styles.input}
                value={formData.price}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, '');
                  if (!digits) {
                    handleInputChange('price', '');
                    return;
                  }
                  const padded = digits.padStart(3, '0');
                  const intPartRaw = padded.slice(0, -2);
                  const intPart = intPartRaw.replace(/^0+(?=\d)/, '') || '0';
                  const fracPart = padded.slice(-2);
                  handleInputChange('price', `${intPart},${fracPart}`);
                }}
                placeholder="Ex: 85,00"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Empresa *</Text>
              <TextInput
                editable={false}
                style={styles.input}
                value={formData.bus_company}
                onChangeText={(text) => handleInputChange('bus_company', text)}
                placeholder="Nome da empresa"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Motorista *</Text>
              <View style={styles.input}>
                <Picker
                  selectedValue={formData.driverId}
                  onValueChange={(value) => handleInputChange('driverId', value as string)}
                >
                  <Picker.Item label={driversLoading ? 'Carregando...' : 'Selecione um motorista'} value="" color="#9CA3AF" />
                  {drivers.map((d) => (
                    <Picker.Item key={d.id} label={d.name} value={d.id} color="#1F2937" />
                  ))}
                </Picker>
              </View>
              {!driversLoading && !formData.driverId ? (
                <Text style={{ color: '#EF4444', marginTop: 4 }}>Selecione um motorista</Text>
              ) : null}
              {driversError ? (
                <Text style={{ color: '#EF4444', marginTop: 4 }}>{driversError}</Text>
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Segundo Motorista (opcional)</Text>
              <View style={styles.input}>
                <Picker
                  selectedValue={formData.secondDriverId}
                  onValueChange={(value) => handleInputChange('secondDriverId', value as string)}
                >
                  <Picker.Item label={driversLoading ? 'Carregando...' : 'Selecione um segundo motorista'} value="" color="#9CA3AF" />
                  {drivers.filter((d) => d.id !== formData.driverId).map((d) => (
                    <Picker.Item key={d.id} label={d.name} value={d.id} color="#1F2937" />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Ônibus *</Text>
              <View style={styles.input}>
                <Picker
                  selectedValue={formData.busId}
                  onValueChange={(value) => handleInputChange('busId', value as string)}
                >
                  <Picker.Item label={busesLoading ? 'Carregando...' : 'Selecione um ônibus'} value="" color="#9CA3AF" />
                  {buses.map((bus) => (
                    <Picker.Item 
                      key={bus.id} 
                      label={`${bus.plate} - ${bus.model} (${bus.type})`} 
                      value={bus.id} 
                      color="#1F2937" 
                    />
                  ))}
                </Picker>
              </View>
              {!busesLoading && !formData.busId ? (
                <Text style={{ color: '#EF4444', marginTop: 4 }}>Selecione um ônibus</Text>
              ) : null}
              {busesError ? (
                <Text style={{ color: '#EF4444', marginTop: 4 }}>{busesError}</Text>
              ) : null}
            </View>

            {/* Motorista vinculado */}    

          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle" size={20} color="#6B7280" />
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleAddRoute}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Salvar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  // Estilos para os novos campos
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  pickerOptionSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  pickerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  pickerTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  amenityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  amenityChipSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  amenityText: {
    fontSize: 12,
    color: '#6B7280',
  },
  amenityTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  routesList: {
    flex: 1,
    padding: 20,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  routeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routeActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 8,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalBody: {
    maxHeight: '80%',
    marginBottom: 8,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  
  loader: {
    marginTop: 20,
  },
  errorContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  errorText: {
    color: '#EF4444',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  noRoutesText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#6B7280',
  },
});

const formatBusTypeForDisplay = (type: string) => {
  const t = (type || '').toLowerCase().trim();
  if (t === 'convencional') return 'Convencional';
  if (t === 'executivo') return 'Executivo';
  if (t === 'leito') return 'Leito';
  return t || 'Convencional';
};
