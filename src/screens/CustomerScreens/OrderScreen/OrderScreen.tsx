import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Chip, Snackbar } from 'react-native-paper';
import OrderDetailModal from '../../../components/CustomerScreenComponents/OrderScreenComponents/OrderDetailModal';
import OrderItemCard from '../../../components/CustomerScreenComponents/OrderScreenComponents/OrderItemCard';
import { useAuth } from '../../../context/AuthContext';
import {
    cancelOrder,
    createReturnRequest,
    getCustomerOrderById,
    getCustomerOrders,
    getGhnOrderByStoreOrderId,
    requestCancelOrder,
} from '../../../services/orderService';
import { CustomerOrder, GHNOrderResponse, OrderStatus, ReturnReasonType } from '../../../types/order';

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

const getStatusLabel = (status: OrderStatus): string => {
  const labels: Record<OrderStatus, string> = {
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

const getStatusColor = (status: OrderStatus): string => {
  const colors: Record<OrderStatus, string> = {
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

const OrderScreen: React.FC = () => {
  const navigation = useNavigation();
  const { authState, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [ghnOrderData, setGhnOrderData] = useState<Record<string, GHNOrderResponse['data']>>({});

  const loadOrders = useCallback(
    async (pageNum: number = 0, append: boolean = false) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken || !isAuthenticated) {
        return;
      }

      try {
        if (!append) {
          setIsLoading(true);
        }
        const res = await getCustomerOrders({
          customerId,
          accessToken,
          params: {
            page: pageNum,
            size: 20,
            status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          },
        });

        if (append) {
          setOrders((prev) => [...prev, ...res.data]);
        } else {
          setOrders(res.data);
        }
        setTotalPages(res.totalPages);
        setHasMore(pageNum < res.totalPages - 1);

        // Load GHN order data for each storeOrder (parallel, background)
        const ghnDataPromises: Promise<void>[] = [];
        res.data.forEach((order) => {
          if (!Array.isArray(order.storeOrders)) return;
          order.storeOrders.forEach((storeOrder) => {
            if (!storeOrder.id || storeOrder.id.includes('-store-')) return;
            if (!ghnOrderData[storeOrder.id]) {
              ghnDataPromises.push(
                getGhnOrderByStoreOrderId({ accessToken, storeOrderId: storeOrder.id })
                  .then((ghnOrder) => {
                    if (ghnOrder && ghnOrder.data) {
                      setGhnOrderData((prev) => ({
                        ...prev,
                        [storeOrder.id]: ghnOrder.data,
                      }));
                    }
                  })
                  .catch(() => {
                    // 404/500 is normal - order doesn't have GHN tracking yet
                  }),
              );
            }
          });
        });
        Promise.all(ghnDataPromises).catch(() => {});
      } catch (error: any) {
        const message =
          error?.response?.data?.message || 'Không thể tải danh sách đơn hàng. Vui lòng thử lại.';
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [authState.decodedToken?.customerId, authState.accessToken, isAuthenticated, selectedStatus, ghnOrderData],
  );

  useEffect(() => {
    if (isAuthenticated) {
      setPage(0);
      loadOrders(0, false);
    }
  }, [isAuthenticated, selectedStatus, loadOrders]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setPage(0);
    loadOrders(0, false);
  }, [loadOrders]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadOrders(nextPage, true);
    }
  }, [isLoading, hasMore, page, loadOrders]);

  const handleOrderPress = useCallback(
    async (order: CustomerOrder) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) {
        return;
      }

      try {
        setIsLoading(true);
        const orderDetail = await getCustomerOrderById({ customerId, accessToken, orderId: order.id });
        if (orderDetail) {
          setSelectedOrder(orderDetail);
        } else {
          setSnackbarMessage('Không thể tải chi tiết đơn hàng.');
          setSnackbarVisible(true);
        }
      } catch (error: any) {
        setSnackbarMessage('Không thể tải chi tiết đơn hàng. Vui lòng thử lại.');
        setSnackbarVisible(true);
      } finally {
        setIsLoading(false);
      }
    },
    [authState.decodedToken?.customerId, authState.accessToken],
  );

  const handleCancelOrder = useCallback(
    async (orderId: string, reason: string, note?: string) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) {
        return;
      }

      try {
        await cancelOrder({
          customerId,
          accessToken,
          orderId,
          reason: reason as any,
          note,
        });
        setSnackbarMessage('Hủy đơn hàng thành công');
        setSnackbarVisible(true);
        setSelectedOrder(null);
        handleRefresh();
      } catch (error: any) {
        const message =
          error?.response?.data?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại.';
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }
    },
    [authState.decodedToken?.customerId, authState.accessToken, handleRefresh],
  );

  const handleRequestCancel = useCallback(
    async (orderId: string, reason: string, note?: string) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) {
        return;
      }

      try {
        await requestCancelOrder({
          customerId,
          accessToken,
          orderId,
          reason: reason as any,
          note,
        });
        setSnackbarMessage('Yêu cầu hủy đơn hàng đã được gửi đến cửa hàng.');
        setSnackbarVisible(true);
        setSelectedOrder(null);
        handleRefresh();
      } catch (error: any) {
        const message =
          error?.response?.data?.message || 'Không thể gửi yêu cầu hủy. Vui lòng thử lại.';
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }
    },
    [authState.decodedToken?.customerId, authState.accessToken, handleRefresh],
  );

  const handleReturnRequest = useCallback(
    async (payload: {
      orderId: string;
      storeOrderId: string;
      orderItemId: string;
      reasonType: ReturnReasonType;
      reason: string;
      images?: string[];
      video?: string;
    }) => {
      const accessToken = authState.accessToken;
      if (!accessToken) {
        return;
      }

      try {
        await createReturnRequest({ accessToken, payload });
        setSnackbarMessage('Yêu cầu hoàn trả đã được gửi thành công');
        setSnackbarVisible(true);
        setSelectedOrder(null);
        handleRefresh();
      } catch (error: any) {
        const message =
          error?.response?.data?.message || 'Không thể tạo yêu cầu hoàn trả. Vui lòng thử lại.';
        setSnackbarMessage(message);
        setSnackbarVisible(true);
      }
    },
    [authState.accessToken, handleRefresh],
  );

  const statusFilters: Array<{ label: string; value: OrderStatus | 'ALL' }> = [
    { label: 'Tất cả', value: 'ALL' },
    { label: 'Chờ xử lý', value: 'PENDING' },
    { label: 'Chờ giao hàng', value: 'AWAITING_SHIPMENT' },
    { label: 'Đang vận chuyển', value: 'SHIPPING' },
    { label: 'Giao thành công', value: 'DELIVERY_SUCCESS' },
    { label: 'Hoàn thành', value: 'COMPLETED' },
    { label: 'Đã hủy', value: 'CANCELLED' },
  ];

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đơn hàng của tôi</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="account-off-outline" size={64} color="#9E9E9E" />
          <Text style={styles.emptyText}>Vui lòng đăng nhập để xem đơn hàng</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đơn hàng của tôi</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {statusFilters.map((filter) => (
          <Chip
            key={filter.value}
            selected={selectedStatus === filter.value}
            onPress={() => setSelectedStatus(filter.value)}
            style={[
              styles.filterChip,
              selectedStatus === filter.value && styles.filterChipSelected,
            ]}
            textStyle={[
              styles.filterChipText,
              selectedStatus === filter.value && styles.filterChipTextSelected,
            ]}
          >
            {filter.label}
          </Chip>
        ))}
      </ScrollView>

      {isLoading && orders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.loadingText}>Đang tải đơn hàng...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="package-variant" size={64} color="#9E9E9E" />
          <Text style={styles.emptyText}>Chưa có đơn hàng nào</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <OrderItemCard
              order={item}
              ghnOrderData={ghnOrderData}
              onPress={() => handleOrderPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={ORANGE} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={ORANGE} />
              </View>
            ) : null
          }
        />
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          ghnOrderData={ghnOrderData}
          onClose={() => setSelectedOrder(null)}
          onCancel={handleCancelOrder}
          onRequestCancel={handleRequestCancel}
          onReturn={handleReturnRequest}
        />
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Đóng',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

export default OrderScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: ORANGE,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  filterContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#F5F5F5',
    height: 40,
    paddingHorizontal: 12,
  },
  filterChipSelected: {
    backgroundColor: ORANGE,
    height: 40,
    paddingHorizontal: 12,
  },
  filterChipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 16,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});

