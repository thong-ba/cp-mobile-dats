import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, RadioButton, TextInput } from 'react-native-paper';
import { CustomerOrder, ReturnReasonType } from '../../../types/order';

const ORANGE = '#FF6A00';

const returnReasons: Array<{ label: string; value: ReturnReasonType }> = [
  { label: 'Sản phẩm bị lỗi', value: 'DEFECTIVE' },
  { label: 'Sai sản phẩm', value: 'WRONG_ITEM' },
  { label: 'Không đúng mô tả', value: 'NOT_AS_DESCRIBED' },
  { label: 'Sản phẩm bị hỏng', value: 'DAMAGED' },
  { label: 'Lý do khác', value: 'OTHER' },
];

interface ReturnRequestModalProps {
  order: CustomerOrder;
  onClose: () => void;
  onConfirm: (payload: {
    orderId: string;
    storeOrderId: string;
    orderItemId: string;
    reasonType: ReturnReasonType;
    reason: string;
    images?: string[];
    video?: string;
  }) => void;
}

const ReturnRequestModal: React.FC<ReturnRequestModalProps> = ({ order, onClose, onConfirm }) => {
  const [selectedStoreOrderId, setSelectedStoreOrderId] = useState<string>(
    order.storeOrders[0]?.id || '',
  );
  const [selectedItemId, setSelectedItemId] = useState<string>(
    order.storeOrders[0]?.items[0]?.id || '',
  );
  const [selectedReason, setSelectedReason] = useState<ReturnReasonType>('DEFECTIVE');
  const [reasonText, setReasonText] = useState('');

  const selectedStoreOrder = order.storeOrders.find((so) => so.id === selectedStoreOrderId);
  const availableItems = selectedStoreOrder?.items || [];

  const handleConfirm = () => {
    if (selectedStoreOrderId && selectedItemId && selectedReason && reasonText.trim()) {
      onConfirm({
        orderId: order.id,
        storeOrderId: selectedStoreOrderId,
        orderItemId: selectedItemId,
        reasonType: selectedReason,
        reason: reasonText.trim(),
        // TODO: Add image/video upload functionality
        images: undefined,
        video: undefined,
      });
    }
  };

  return (
    <Modal visible={true} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Yêu cầu hoàn trả sản phẩm</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Vui lòng chọn sản phẩm và điền thông tin yêu cầu hoàn trả:
            </Text>

            {order.storeOrders.length > 1 && (
              <>
                <Text style={styles.label}>Chọn cửa hàng *</Text>
                {order.storeOrders.map((storeOrder) => (
                  <TouchableOpacity
                    key={storeOrder.id}
                    style={styles.radioRow}
                    onPress={() => {
                      setSelectedStoreOrderId(storeOrder.id);
                      setSelectedItemId(storeOrder.items[0]?.id || '');
                    }}
                  >
                    <RadioButton
                      value={storeOrder.id}
                      status={selectedStoreOrderId === storeOrder.id ? 'checked' : 'unchecked'}
                      onPress={() => {
                        setSelectedStoreOrderId(storeOrder.id);
                        setSelectedItemId(storeOrder.items[0]?.id || '');
                      }}
                      color={ORANGE}
                    />
                    <Text style={styles.radioLabel}>{storeOrder.storeName}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={styles.label}>Chọn sản phẩm *</Text>
            {availableItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.radioRow}
                onPress={() => setSelectedItemId(item.id)}
              >
                <RadioButton
                  value={item.id}
                  status={selectedItemId === item.id ? 'checked' : 'unchecked'}
                  onPress={() => setSelectedItemId(item.id)}
                  color={ORANGE}
                />
                <Text style={styles.radioLabel}>{item.name}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Lý do hoàn trả *</Text>
            {returnReasons.map((reason) => (
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

            <Text style={styles.label}>Mô tả chi tiết *</Text>
            <TextInput
              mode="outlined"
              placeholder="Nhập mô tả chi tiết về lý do hoàn trả..."
              value={reasonText}
              onChangeText={setReasonText}
              multiline
              numberOfLines={4}
              style={styles.noteInput}
            />

            <Text style={styles.note}>
              Lưu ý: Bạn có thể đính kèm hình ảnh/video để hỗ trợ yêu cầu hoàn trả (tính năng đang phát triển)
            </Text>
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
              disabled={!selectedStoreOrderId || !selectedItemId || !selectedReason || !reasonText.trim()}
            >
              Gửi yêu cầu
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ReturnRequestModal;

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
  note: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    fontStyle: 'italic',
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

