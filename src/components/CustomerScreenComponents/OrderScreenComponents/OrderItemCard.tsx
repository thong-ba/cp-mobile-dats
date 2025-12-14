import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { CustomerOrder, GHNOrderResponse } from '../../../types/order';

const ORANGE = '#FF6A00';

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

interface OrderItemCardProps {
  order: CustomerOrder;
  ghnOrderData: Record<string, GHNOrderResponse['data']>;
  onPress: () => void;
}

const OrderItemCard: React.FC<OrderItemCardProps> = ({ order, ghnOrderData, onPress }) => {
  const firstStoreOrder = order.storeOrders?.[0];
  const firstItem = firstStoreOrder?.items?.[0];

  // Get GHN tracking code if available
  const hasGhnTracking = firstStoreOrder && ghnOrderData[firstStoreOrder.id];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderCode}>
            {order.orderCode || order.externalOrderCode || `#${order.id.slice(0, 8)}`}
          </Text>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
        <Chip
          style={[styles.statusChip, { backgroundColor: getStatusColor(order.status) + '20' }]}
          textStyle={[styles.statusText, { color: getStatusColor(order.status) }]}
        >
          {getStatusLabel(order.status)}
        </Chip>
      </View>

      {firstItem && (
        <View style={styles.itemRow}>
          {firstItem.image && (
            <Image source={{ uri: firstItem.image }} style={styles.itemImage} />
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>
              {firstItem.name}
            </Text>
            {firstItem.variantOptionValue && (
              <Text style={styles.variantText}>{firstItem.variantOptionValue}</Text>
            )}
            <Text style={styles.itemQuantity}>Số lượng: {firstItem.quantity}</Text>
            {order.storeOrders.length > 1 && (
              <Text style={styles.moreStores}>+{order.storeOrders.length - 1} cửa hàng khác</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng tiền:</Text>
          <Text style={styles.totalValue}>{formatCurrencyVND(order.grandTotal)}</Text>
        </View>
        {hasGhnTracking && (
          <View style={styles.trackingRow}>
            <MaterialCommunityIcons name="truck-delivery" size={16} color={ORANGE} />
            <Text style={styles.trackingText}>
              Mã vận đơn: {ghnOrderData[firstStoreOrder!.id].orderGhn}
            </Text>
          </View>
        )}
        <View style={styles.actionRow}>
          <Text style={styles.viewDetailText}>Xem chi tiết</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={ORANGE} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default OrderItemCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
  },
  statusChip: {
    height: 32,
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
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
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
  moreStores: {
    fontSize: 12,
    color: ORANGE,
    marginTop: 4,
    fontWeight: '600',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ORANGE,
  },
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  trackingText: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  viewDetailText: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '600',
    marginRight: 4,
  },
});

