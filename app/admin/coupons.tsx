import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { couponsService, type Coupon } from '../../services/coupons';

export default function CouponsManagement() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    starts_at: '',
    ends_at: '',
    status: 'active' as 'active' | 'inactive',
    usage_limit: '',
  });

  // Helpers de data no formato BR (DD/MM/AAAA)
  const formatDateInputBR = (input: string) => {
    const digits = input.replace(/\D/g, '').slice(0, 8);
    const parts = [digits.slice(0,2), digits.slice(2,4), digits.slice(4,8)].filter(Boolean);
    return parts.join('/');
  };
  const brDateToISO = (br: string): string | undefined => {
    const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return undefined;
    const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yyyy = parseInt(m[3], 10);
    const date = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    if (isNaN(date.getTime())) return undefined;
    return date.toISOString();
  };
  const loadCoupons = async () => {
    try {
      setLoading(true);
      const data = await couponsService.getAll();
      setCoupons(data);
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCoupons(); }, []);

  const resetForm = () => {
    setForm({
      code: '', description: '', discount_type: 'percentage', discount_value: '',
      starts_at: '', ends_at: '', status: 'active', usage_limit: ''
    });
  };

  const openModal = () => { resetForm(); setModalVisible(true); };
  const closeModal = () => setModalVisible(false);

  const handleCreate = async () => {
    try {
      if (!form.code.trim()) { Alert.alert('Validação', 'Informe o código do cupom'); return; }
      if (!form.discount_value.trim()) { Alert.alert('Validação', 'Informe o valor do desconto'); return; }
      const value = parseFloat(form.discount_value.replace(',', '.'));
      if (isNaN(value) || value <= 0) { Alert.alert('Validação', 'Valor de desconto inválido'); return; }
      if (form.discount_type === 'percentage' && (value <= 0 || value > 100)) {
        Alert.alert('Validação', 'Percentual deve estar entre 1 e 100');
        return;
      }

      const startsISO = form.starts_at ? brDateToISO(form.starts_at) : undefined;
      const endsISO = form.ends_at ? brDateToISO(form.ends_at) : undefined;
      if (form.starts_at && !startsISO) { Alert.alert('Validação', 'Data de início inválida (use DD/MM/AAAA)'); return; }
      if (form.ends_at && !endsISO) { Alert.alert('Validação', 'Data de fim inválida (use DD/MM/AAAA)'); return; }

      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        discount_type: form.discount_type,
        discount_value: value,
        starts_at: startsISO,
        ends_at: endsISO,
        status: form.status,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit, 10) : undefined,
      } as any;

      await couponsService.create(payload);
      await loadCoupons();
      closeModal();
      Alert.alert('Sucesso', 'Cupom criado com sucesso');
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Falha ao criar cupom');
    }
  };

  const renderItem = ({ item }: { item: Coupon }) => (
    <View style={styles.couponCard}>
      <View style={styles.couponHeader}>
        <Text style={styles.couponCode}>{item.code}</Text>
        <View style={[styles.statusBadge, item.status === 'active' ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={styles.statusText}>{item.status === 'active' ? 'Ativo' : 'Inativo'}</Text>
        </View>
      </View>
      {item.description ? <Text style={styles.couponDesc}>{item.description}</Text> : null}
      <View style={styles.couponDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="pricetag" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {item.discount_type === 'percentage' ? `${item.discount_value}%` : `R$ ${String(item.discount_value.toFixed(2)).replace('.', ',')}`}
          </Text>
        </View>
        {item.usage_limit ? (
          <View style={styles.detailItem}>
            <Ionicons name="repeat" size={16} color="#6B7280" />
            <Text style={styles.detailText}>{item.used_count}/{item.usage_limit} usos</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton} onPress={async () => {
          const nextStatus = item.status === 'active' ? 'inactive' : 'active';
          await couponsService.update(item.id, { status: nextStatus });
          await loadCoupons();
        }}>
          <Ionicons name="power" size={18} color="#6B7280" />
          <Text style={styles.actionText}>{item.status === 'active' ? 'Desativar' : 'Ativar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gerenciar Cupons</Text>
        <TouchableOpacity style={styles.addButton} onPress={openModal}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Novo Cupom</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={coupons}
        keyExtractor={(c) => c.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Nenhum cupom cadastrado</Text>
          </View>
        }
        refreshing={loading}
        onRefresh={loadCoupons}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Cupom</Text>
              <TouchableOpacity onPress={closeModal}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }] }>
                  <Text style={styles.label}>Código *</Text>
                  <TextInput style={styles.input} value={form.code} onChangeText={(t) => setForm({ ...form, code: t })} placeholder="Ex: PROMO10" />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Tipo *</Text>
                  <View style={styles.typePicker}>
                    <TouchableOpacity style={[styles.typeOption, form.discount_type === 'percentage' && styles.typeSelected]} onPress={() => setForm({ ...form, discount_type: 'percentage' })}>
                      <Text numberOfLines={1} style={[styles.typeText, form.discount_type === 'percentage' && styles.typeTextSelected]}>Percentual (%)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.typeOption, form.discount_type === 'fixed' && styles.typeSelected]} onPress={() => setForm({ ...form, discount_type: 'fixed' })}>
                      <Text numberOfLines={1} style={[styles.typeText, form.discount_type === 'fixed' && styles.typeTextSelected]}>Valor (R$)</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }] }>
                  <Text style={styles.label}>Valor *</Text>
                  <TextInput style={styles.input} value={form.discount_value} onChangeText={(t) => setForm({ ...form, discount_value: t })} placeholder={form.discount_type === 'percentage' ? 'Ex: 10' : 'Ex: 25,00'} keyboardType="numeric" />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Status *</Text>
                  <View style={styles.typePicker}>
                    <TouchableOpacity style={[styles.typeOption, form.status === 'active' && styles.typeSelected]} onPress={() => setForm({ ...form, status: 'active' })}>
                      <Text style={[styles.typeText, form.status === 'active' && styles.typeTextSelected]}>Ativo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.typeOption, form.status === 'inactive' && styles.typeSelected]} onPress={() => setForm({ ...form, status: 'inactive' })}>
                      <Text style={[styles.typeText, form.status === 'inactive' && styles.typeTextSelected]}>Inativo</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            
              <View style={styles.formGroup}>
                <Text style={styles.label}>Descrição</Text>
                <TextInput style={styles.input} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="Explicação breve (opcional)" />
              </View>
            
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }] }>
                  <Text style={styles.label}>Início</Text>
                  <TextInput style={styles.input} value={form.starts_at} onChangeText={(t) => setForm({ ...form, starts_at: formatDateInputBR(t) })} placeholder="DD/MM/AAAA" keyboardType="numeric" />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Fim</Text>
                  <TextInput style={styles.input} value={form.ends_at} onChangeText={(t) => setForm({ ...form, ends_at: formatDateInputBR(t) })} placeholder="DD/MM/AAAA" keyboardType="numeric" />
                </View>
              </View>
            
              <View style={styles.formGroup}>
                <Text style={styles.label}>Limite de uso</Text>
                <TextInput style={styles.input} value={form.usage_limit} onChangeText={(t) => setForm({ ...form, usage_limit: t })} placeholder="Ex: 100" keyboardType="numeric" />
              </View>
            
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                <Ionicons name="close" size={20} color="#6B7280" />
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleCreate}>
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  addButton: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, gap: 8 },
  addButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
  listContainer: { padding: 20 },
  couponCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  couponHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  couponCode: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadge: { backgroundColor: '#D1FAE5' },
  inactiveBadge: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  couponDesc: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  couponDetails: { flexDirection: 'row', gap: 16, marginTop: 8 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 14, color: '#6B7280' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 12, paddingTop: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: '#6B7280' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 0, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
  modalBody: { maxHeight: '80%', marginBottom: 8 },
  formRow: { flexDirection: 'row' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB' },
  typePicker: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', flexGrow: 1, flexBasis: '48%', alignItems: 'center' },
  typeText: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  typeTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  typeSelected: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  modalButton: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  cancelButton: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#D1D5DB' },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  saveButton: { backgroundColor: '#DC2626' },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#6B7280', marginTop: 12 },
});