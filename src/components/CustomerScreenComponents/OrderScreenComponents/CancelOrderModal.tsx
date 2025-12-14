import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, RadioButton, TextInput } from 'react-native-paper';
import { CancelReason, CustomerOrder } from '../../../types/order';

const ORANGE = '#FF6A00';

const cancelReasons: Array<{ label: string; value: CancelReason }> = [
  { label: 'Thay đổi ý định', value: 'CHANGE_OF_MIND' },
  { label: 'Tìm thấy giá tốt hơn', value: 'FOUND_BETTER_PRICE' },
  { label: 'Sai thông tin hoặc địa chỉ', value: 'WRONG_INFO_OR_ADDRESS' },
  { label: 'Đặt nhầm', value: 'ORDERED_BY_ACCIDENT' },
  { label: 'Hết hàng', value: 'OUT_OF_STOCK' },
  { label: 'Giao hàng quá lâu', value: 'DELIVERY_TOO_LONG' },
  { label: 'Lý do khác', value: 'OTHER' },
];

interface CancelOrderModalProps {
  order: CustomerOrder;
  onClose: () => void;
  onConfirm: (reason: string, note?: string) => void;
  isRequestCancel?: boolean;
}

const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  order,
  onClose,
  onConfirm,
  isRequestCancel = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<CancelReason>('CHANGE_OF_MIND');
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason, note.trim() || undefined);
    }
  };

  return (
    <Modal visible={true} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isRequestCancel ? 'Yêu cầu hủy đơn hàng' : 'Hủy đơn hàng'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              {isRequestCancel
                ? 'Yêu cầu hủy đơn hàng sẽ được gửi đến cửa hàng để xem xét. Vui lòng chọn lý do hủy:'
                : 'Bạn có chắc chắn muốn hủy đơn hàng này? Vui lòng chọn lý do hủy:'}
            </Text>

            <Text style={styles.label}>Lý do hủy *</Text>
            {cancelReasons.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={styles.radioRow}
                onPress={() => setSelectedReason(reason.value)}
              >
                <RadioButton
                  value={reason.value}
                  status={selectedReason === reason.value ? 'checked' : 'unchecked'}
                  onPress={() => setSelectedReason(reason.value)}
                  color={ORANGE}
                />
                <Text style={styles.radioLabel}>{reason.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Ghi chú thêm (tùy chọn)</Text>
            <TextInput
              mode="outlined"
              placeholder="Nhập ghi chú..."
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
              style={styles.noteInput}
            />
          </ScrollView>

          <View style={styles.actionContainer}>
            <Button mode="outlined" onPress={onClose} style={styles.cancelButton} textColor="#666">
              Hủy
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirm}
              style={styles.confirmButton}
              buttonColor={ORANGE}
              disabled={!selectedReason}
            >
              {isRequestCancel ? 'Gửi yêu cầu' : 'Xác nhận hủy'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CancelOrderModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 12,
    marginTop: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioLabel: {
    fontSize: 14,
    color: '#222',
    marginLeft: 8,
  },
  noteInput: {
    marginTop: 8,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
});

