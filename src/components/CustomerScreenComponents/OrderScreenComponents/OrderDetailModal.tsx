import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Image, Linking, Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Chip, Divider } from 'react-native-paper';
import { CustomerOrder, GHNOrderResponse, ReturnReasonType } from '../../../types/order';
import CancelOrderModal from './CancelOrderModal';
import ReturnRequestModal from './ReturnRequestModal';

const ORANGE = '#FF6A00';

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Chờ xử lý',
    UNPAID: 'Chưa thanh toán',
    AWAITING_SHIPMENT: 'Chờ giao hàng',
    SHIPPING: 'Đang vận chuyển',
    DELIVERY_SUCCESS: 'Giao hàng thành công',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    RETURN_REQUESTED: 'Yêu cầu hoàn trả',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    PENDING: '#FF9800',
    UNPAID: '#F44336',
    AWAITING_SHIPMENT: '#2196F3',
    SHIPPING: '#4CAF50',
    DELIVERY_SUCCESS: '#4CAF50',
    COMPLETED: '#4CAF50',
    CANCELLED: '#9E9E9E',
    RETURN_REQUESTED: '#FF5722',
  };
  return colors[status] || '#9E9E9E';
};

interface OrderDetailModalProps {
  order: CustomerOrder;
  ghnOrderData: Record<string, GHNOrderResponse['data']>;
  onClose: () => void;
  onCancel: (orderId: string, reason: string, note?: string) => Promise<void>;
  onRequestCancel: (orderId: string, reason: string, note?: string) => Promise<void>;
  onReturn: (payload: {
    orderId: string;
    storeOrderId: string;
    orderItemId: string;
    reasonType: ReturnReasonType;
    reason: string;
    images?: string[];
    video?: string;
  }) => Promise<void>;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  ghnOrderData,
  onClose,
  onCancel,
  onRequestCancel,
  onReturn,
}) => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const canCancel = order.status === 'PENDING';
  const canRequestCancel = order.status === 'AWAITING_SHIPMENT';
  const canReturn = order.status === 'DELIVERY_SUCCESS';

  const handleTrackOrder = async (storeOrderId: string) => {
    const ghnData = ghnOrderData[storeOrderId];
    if (ghnData?.orderGhn) {
      const trackingUrl = `https://donhang.ghn.vn/?order_code=${ghnData.orderGhn}`;
      const canOpen = await Linking.canOpenURL(trackingUrl);
      if (canOpen) {
        await Linking.openURL(trackingUrl);
      }
    }
  };

  return (
    <>
      <Modal visible={true} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết đơn hàng</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Order Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mã đơn hàng:</Text>
                  <Text style={styles.infoValue}>
                    {order.orderCode || order.externalOrderCode || `#${order.id.slice(0, 8)}`}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ngày đặt:</Text>
                  <Text style={styles.infoValue}>{formatDate(order.createdAt)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Trạng thái:</Text>
                  <Chip
                    style={[styles.statusChip, { backgroundColor: getStatusColor(order.status) + '20' }]}
                    textStyle={[styles.statusText, { color: getStatusColor(order.status) }]}
                  >
                    {getStatusLabel(order.status)}
                  </Chip>
                </View>
              </View>

              {/* Delivery Address */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
                <Text style={styles.addressText}>
                  {order.receiverName} - {order.phoneNumber}
                </Text>
                <Text style={styles.addressText}>
                  {order.addressLine}, {order.street}, {order.ward}, {order.district}, {order.province}
                </Text>
              </View>

              {/* Store Orders */}
              {order.storeOrders.map((storeOrder) => {
                const ghnData = ghnOrderData[storeOrder.id];
                return (
                  <View key={storeOrder.id} style={styles.section}>
                    <Text style={styles.sectionTitle}>{storeOrder.storeName}</Text>
                    {storeOrder.items.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        {item.image && (
                          <Image source={{ uri: item.image }} style={styles.itemImage} />
                        )}
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {item.variantOptionValue && (
                            <Text style={styles.variantText}>{item.variantOptionValue}</Text>
                          )}
                          <Text style={styles.itemPrice}>
                            {formatCurrencyVND(item.unitPrice)} x {item.quantity}
                          </Text>
                        </View>
                        <Text style={styles.itemTotal}>{formatCurrencyVND(item.lineTotal)}</Text>
                      </View>
                    ))}
                    <Divider style={styles.divider} />
                    <View style={styles.storeTotalRow}>
                      <Text style={styles.storeTotalLabel}>Tổng cửa hàng:</Text>
                      <Text style={styles.storeTotalValue}>
                        {formatCurrencyVND(storeOrder.grandTotal)}
                      </Text>
                    </View>
                    {ghnData?.orderGhn && (
                      <TouchableOpacity
                        style={styles.trackButton}
                        onPress={() => handleTrackOrder(storeOrder.id)}
                      >
                        <MaterialCommunityIcons name="truck-delivery" size={20} color={ORANGE} />
                        <Text style={styles.trackButtonText}>
                          Theo dõi: {ghnData.orderGhn}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {/* Order Summary */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tổng tiền hàng:</Text>
                  <Text style={styles.summaryValue}>{formatCurrencyVND(order.totalAmount)}</Text>
                </View>
                {order.discountTotal > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Giảm giá:</Text>
                    <Text style={[styles.summaryValue, styles.discountValue]}>
                      -{formatCurrencyVND(order.discountTotal)}
                    </Text>
                  </View>
                )}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Phí vận chuyển:</Text>
                  <Text style={styles.summaryValue}>{formatCurrencyVND(order.shippingFeeTotal)}</Text>
                </View>
                <Divider style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.grandTotalLabel}>Tổng cộng:</Text>
                  <Text style={styles.grandTotalValue}>{formatCurrencyVND(order.grandTotal)}</Text>
                </View>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
              {canCancel && (
                <Button
                  mode="outlined"
                  onPress={() => setShowCancelModal(true)}
                  style={styles.actionButton}
                  textColor={ORANGE}
                >
                  Hủy đơn hàng
                </Button>
              )}
              {canRequestCancel && (
                <Button
                  mode="outlined"
                  onPress={() => setShowCancelModal(true)}
                  style={styles.actionButton}
                  textColor={ORANGE}
                >
                  Yêu cầu hủy
                </Button>
              )}
              {canReturn && (
                <Button
                  mode="contained"
                  onPress={() => setShowReturnModal(true)}
                  style={[styles.actionButton, styles.returnButton]}
                  buttonColor={ORANGE}
                >
                  Hoàn trả sản phẩm
                </Button>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {showCancelModal && (
        <CancelOrderModal
          order={order}
          onClose={() => setShowCancelModal(false)}
          onConfirm={(reason, note) => {
            if (canCancel) {
              onCancel(order.id, reason, note);
            } else if (canRequestCancel) {
              onRequestCancel(order.id, reason, note);
            }
            setShowCancelModal(false);
          }}
          isRequestCancel={canRequestCancel}
        />
      )}

      {showReturnModal && (
        <ReturnRequestModal
          order={order}
          onClose={() => setShowReturnModal(false)}
          onConfirm={onReturn}
        />
      )}
    </>
  );
};

export default OrderDetailModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  statusChip: {
    height: 36,
    paddingHorizontal: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  variantText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 12,
    color: '#666',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: ORANGE,
  },
  divider: {
    marginVertical: 12,
  },
  storeTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeTotalLabel: {
    fontSize: 14,
    color: '#666',
  },
  storeTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ORANGE,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF3EB',
    borderRadius: 8,
  },
  trackButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ORANGE,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  discountValue: {
    color: '#4CAF50',
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: ORANGE,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flex: 1,
  },
  returnButton: {
    flex: 1,
  },
});

