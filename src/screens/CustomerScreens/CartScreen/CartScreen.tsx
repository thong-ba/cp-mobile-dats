import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from 'react-native-paper';
import { CartItemList } from '../../../components/CustomerScreenComponents/CartComponents';
import { useAuth } from '../../../context/AuthContext';
import { deleteCartItems, getCustomerCart } from '../../../services/cartService';
import { Cart } from '../../../types/cart';

const ORANGE = '#FF6A00';

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const CartScreen: React.FC = () => {
  const navigation = useNavigation();
  const { authState, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check authentication when screen is focused
  useEffect(() => {
    if (!isAuthenticated) {
      // Navigate to Profile tab (which will show Login screen if not authenticated)
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        // @ts-ignore - navigate to Profile tab
        tabNavigator.navigate('Profile');
      }
    }
  }, [isAuthenticated, navigation]);

  const loadCart = useCallback(
    async (isPullRefresh = false) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;

      if (!customerId || !accessToken) {
        // Don't set error message, just navigate to login
        // The useEffect will handle navigation
        return;
      }

      try {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);
        const data = await getCustomerCart({ customerId, accessToken });
        setCart(data);
      } catch (error: any) {
        console.error('[CartScreen] loadCart failed', error);
        const message =
          error?.response?.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : error?.response?.status === 404
            ? 'Giỏ hàng trống'
            : error?.message?.includes('Network')
            ? 'Không có kết nối mạng. Vui lòng thử lại.'
            : 'Không thể tải giỏ hàng. Vui lòng thử lại.';
        setErrorMessage(message);
      } finally {
        if (isPullRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [authState.accessToken, authState.decodedToken?.customerId],
  );

  const handleRemoveItem = useCallback(
    async (cartItemId: string) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) return;
      try {
        setIsLoading(true);
        await deleteCartItems({
          customerId,
          accessToken,
          cartItemIds: [cartItemId],
        });
        await loadCart(true);
      } catch (error: any) {
        console.error('[CartScreen] delete item failed', error);
        const message =
          error?.response?.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : error?.response?.data?.message || 'Không thể xóa sản phẩm. Vui lòng thử lại.';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    },
    [authState.accessToken, authState.decodedToken?.customerId],
  );

  useFocusEffect(
    useCallback(() => {
      // Only load cart if user is authenticated
      if (isAuthenticated) {
        loadCart();
      }
    }, [loadCart, isAuthenticated]),
  );

  // Poll cart every 10s when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => {
      loadCart(true);
    }, 10000);
    return () => clearInterval(id);
  }, [isAuthenticated, loadCart]);

  // Show login required message if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="lock-outline" size={80} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>Yêu cầu đăng nhập</Text>
          <Text style={styles.emptySubtitle}>
            Vui lòng đăng nhập để xem giỏ hàng của bạn
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => {
              // Navigate to Profile tab (which will show Login screen)
              const tabNavigator = navigation.getParent();
              if (tabNavigator) {
                // @ts-ignore - navigate to Profile tab
                tabNavigator.navigate('Profile');
              }
            }}
          >
            <Text style={styles.shopButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading && !cart) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.loaderText}>Đang tải giỏ hàng...</Text>
      </View>
    );
  }

  if (errorMessage && !cart) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#B3261E" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadCart()}>
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="cart-outline" size={80} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>Giỏ hàng trống</Text>
          <Text style={styles.emptySubtitle}>
            Hãy thêm sản phẩm vào giỏ hàng để tiếp tục mua sắm
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => {
              // @ts-ignore - navigate to Home
              navigation.navigate('Home');
            }}
          >
            <Text style={styles.shopButtonText}>Tiếp tục mua sắm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Derived totals (backend already includes platform discounts in unitPrice/lineTotal)
  const subtotalBeforePlatform = cart.items.reduce((sum, item) => {
    const base = item.baseUnitPrice ?? item.unitPrice;
    return sum + base * item.quantity;
  }, 0);
  const subtotalAfterPlatform = cart.items.reduce((sum, item) => {
    const originalPrice = item.baseUnitPrice ?? item.unitPrice;
    const hasPlatformPrice =
      item.platformCampaignPrice !== null && item.platformCampaignPrice !== undefined;
    const priceDisplay = hasPlatformPrice ? item.platformCampaignPrice! : originalPrice;
    return sum + priceDisplay * item.quantity;
  }, 0);
  const platformDiscount = Math.max(0, subtotalBeforePlatform - subtotalAfterPlatform);
  const otherDiscount = cart.discountTotal ?? 0; // voucher/khác từ backend nếu có
  const total = Math.max(0, subtotalAfterPlatform - otherDiscount);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCart(true)} />}
      >
        <CartItemList items={cart.items} onCartChange={loadCart} onRemoveItem={handleRemoveItem} />
      </ScrollView>

      {/* Bottom Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tạm tính (giá gốc):</Text>
          <Text style={styles.summaryValue}>
            {formatCurrencyVND(subtotalBeforePlatform || cart.subtotal)}
          </Text>
        </View>
        {platformDiscount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm nền tảng:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatCurrencyVND(platformDiscount)}
            </Text>
          </View>
        )}
        {cart.discountTotal > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm giá:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatCurrencyVND(cart.discountTotal)}
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Tổng cộng:</Text>
          <Text style={styles.totalValue}>{formatCurrencyVND(total)}</Text>
        </View>
        <Button
          mode="contained"
          onPress={() => {
            // @ts-ignore
            navigation.navigate('Checkout', { cart });
          }}
          style={styles.checkoutButton}
          contentStyle={styles.checkoutButtonContent}
          labelStyle={styles.checkoutButtonLabel}
        >
          Thanh toán
        </Button>
      </View>
    </View>
  );
};

export default CartScreen;

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
    backgroundColor: ORANGE,
    paddingTop: 50,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 30,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  loaderText: {
    marginTop: 12,
    color: '#555',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F7F7',
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#B3261E',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: ORANGE,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  shopButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: ORANGE,
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  summaryBar: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 5,
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
    color: '#222',
    fontWeight: '600',
  },
  discountValue: {
    color: '#4CAF50',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ORANGE,
  },
  checkoutButton: {
    backgroundColor: ORANGE,
    borderRadius: 12,
  },
  checkoutButtonContent: {
    paddingVertical: 8,
  },
  checkoutButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

