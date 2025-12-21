import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Chip, Divider, List, Snackbar, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import { getCustomerOrders } from '../../../services/orderService';
import { CustomerOrder } from '../../../types/order';

const ProfileScreen = () => {
  const { authState, logout, isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const theme = useTheme();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [logoutSnackbarVisible, setLogoutSnackbarVisible] = useState(false);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const menuItems = [
    { icon: 'account-outline', label: 'Thông tin cá nhân', key: 'profile' },
    { icon: 'map-marker-outline', label: 'Địa chỉ', key: 'address' },
    { icon: 'credit-card-outline', label: 'Phương thức thanh toán', key: 'payment' },
    { icon: 'shopping-outline', label: 'Đơn hàng của tôi', key: 'orders' },
    { icon: 'heart-outline', label: 'Sản phẩm yêu thích', key: 'favorite' },
    { icon: 'cog-outline', label: 'Cài đặt', key: 'settings' },
    { icon: 'help-circle-outline', label: 'Trợ giúp', key: 'help' },
  ];

  const profile = authState.customerProfile;

  // Fetch orders để tính toán stats
  // Fetch tất cả orders (nhiều pages) để tính stats chính xác
  const loadOrders = useCallback(async () => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;
    
    if (!customerId || !accessToken || !isAuthenticated) {
      return;
    }

    try {
      setIsLoadingOrders(true);
      // Fetch page đầu tiên để biết tổng số pages
      const firstPageResult = await getCustomerOrders({
        customerId,
        accessToken,
        params: {
          page: 0,
          size: 100, // Fetch 100 orders mỗi page để giảm số lần gọi API
        },
      });

      let allOrders: CustomerOrder[] = [...firstPageResult.data];
      
      // Nếu có nhiều pages, fetch các pages còn lại
      if (firstPageResult.totalPages > 1) {
        const remainingPages = Array.from(
          { length: firstPageResult.totalPages - 1 },
          (_, i) => i + 1,
        );
        
        const remainingPromises = remainingPages.map((page) =>
          getCustomerOrders({
            customerId,
            accessToken,
            params: {
              page,
              size: 100,
            },
          }),
        );

        const remainingResults = await Promise.all(remainingPromises);
        remainingResults.forEach((result) => {
          allOrders = [...allOrders, ...result.data];
        });
      }

      setOrders(allOrders);
    } catch (error) {
      console.error('[ProfileScreen] Failed to load orders', error);
      setOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [authState.decodedToken?.customerId, authState.accessToken, isAuthenticated]);

  // Load orders khi authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
    } else {
      setOrders([]);
    }
  }, [isAuthenticated, loadOrders]);

  // Tính toán stats từ orders
  const orderStats = useMemo(() => {
    if (orders.length === 0) {
      return {
        total: 0,
        cancelled: 0,
        returned: 0,
        unpaid: 0,
      };
    }

    const total = orders.length;
    const cancelled = orders.filter(
      (order) => order.status === 'CANCELLED',
    ).length;
    const returned = orders.filter(
      (order) =>
        order.status === 'RETURN_REQUESTED' ||
        order.status === 'RETURNED' ||
        order.status === 'RETURNING',
    ).length;
    const unpaid = orders.filter((order) => order.status === 'UNPAID').length;

    return {
      total,
      cancelled,
      returned,
      unpaid,
    };
  }, [orders]);

  const profileDetails = useMemo(() => {
    if (!profile) {
      return [];
    }
    return [
      { label: 'Họ và tên', value: profile.fullName },
      { label: 'Tên người dùng', value: profile.userName },
      { label: 'Email', value: profile.email },
      { label: 'Số điện thoại', value: profile.phoneNumber },
      { label: 'Giới tính', value: profile.gender },
      { label: 'Ngày sinh', value: profile.dateOfBirth },
      { label: 'Trạng thái', value: profile.status },
      { label: 'Xác thực 2 lớp', value: profile.twoFactorEnabled ? 'Bật' : 'Tắt' },
      { label: 'Trạng thái KYC', value: profile.kycStatus },
      { label: 'Lần đăng nhập cuối', value: profile.lastLogin },
      { label: 'Số địa chỉ', value: profile.addressCount },
      { label: 'Số đơn hàng', value: profile.orderCount },
      { label: 'Đơn hủy', value: profile.cancelCount },
      { label: 'Đơn trả', value: profile.returnCount },
      { label: 'Đơn chưa thanh toán', value: profile.unpaidOrderCount },
      { label: 'Đơn gần nhất', value: profile.lastOrderDate },
      { label: 'Danh mục yêu thích', value: profile.preferredCategory },
    ];
  }, [profile]);

  type QuickStat = { label: string; value: number; icon: string };

  const quickStats: QuickStat[] = useMemo(() => {
    // Ưu tiên sử dụng stats từ orders API, fallback về profile nếu chưa load xong
    const stats = isLoadingOrders && orders.length === 0
      ? {
          total: profile?.orderCount || 0,
          cancelled: profile?.cancelCount || 0,
          returned: profile?.returnCount || 0,
          unpaid: profile?.unpaidOrderCount || 0,
        }
      : orderStats;

    return [
      { label: 'Tổng đơn', value: stats.total, icon: 'shopping-outline' },
      { label: 'Đơn hủy', value: stats.cancelled, icon: 'cancel' },
      { label: 'Đơn trả', value: stats.returned, icon: 'package-variant-return' },
      { label: 'Chưa thanh toán', value: stats.unpaid, icon: 'credit-card-off-outline' },
    ];
  }, [orderStats, profile, isLoadingOrders, orders.length]);

  useEffect(
    () => () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    },
    [],
  );

  const handleLogout = async () => {
    console.log('[ProfileScreen] logout requested');
    setLogoutSnackbarVisible(true);
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    try {
      await logout();
      console.log('[ProfileScreen] logout succeeded');
      // ProfileTab will automatically switch to AuthStackNavigator 
      // when isAuthenticated becomes false, so no need to reset navigation
      setLogoutSnackbarVisible(false);
    } catch (error) {
      console.log('[ProfileScreen] logout failed', error);
      setLogoutSnackbarVisible(false);
    }
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card mode="elevated" style={styles.heroCard}>
          <Card.Content>
            <View style={styles.heroRow}>
              {profile?.avatarURL ? (
                <Avatar.Image size={72} source={{ uri: profile.avatarURL }} />
              ) : (
                <Avatar.Icon
                  size={72}
                  icon="account"
                  color={theme.colors.primary}
                  style={{ backgroundColor: '#FFEADB' }}
                />
              )}
              <View style={styles.heroText}>
                <Text variant="titleMedium">
                  {profile?.fullName ?? 'Bạn chưa đăng nhập'}
                </Text>
                <Text variant="bodyMedium" style={styles.email}>
                  {profile?.email ?? 'Hãy đăng nhập để xem thông tin cá nhân'}
                </Text>
                {profile?.phoneNumber && (
                  <Text variant="bodySmall" style={styles.phone}>
                    {profile.phoneNumber}
                  </Text>
                )}
          </View>
        </View>
            {isAuthenticated && (
              <>
                {profile && (
                  <View style={styles.chipRow}>
                    {quickStats.map((stat) => (
                      <Chip
                        key={stat.label}
                        icon={stat.icon as any}
                        elevated
                        style={styles.chip}
                        textStyle={{ fontWeight: '700' }}
                      >
                        {stat.value} {stat.label}
                      </Chip>
                    ))}
                  </View>
                )}
                <Button
                  mode="contained"
                  icon="logout"
                  onPress={handleLogout}
                  style={styles.logoutButton}
                >
                  Đăng xuất
                </Button>
              </>
            )}
            {!isAuthenticated && (
              <Button
                mode="contained"
                icon="account-plus"
                onPress={() => {
                  // Navigate to Register screen
                  navigation.navigate('Register' as never);
                }}
                style={styles.loginButton}
              >
                Tạo tài khoản
              </Button>
            )}
          </Card.Content>
        </Card>

          <List.Section style={styles.listSection}>
          <Card mode="contained" style={styles.detailCard}>
            <Card.Title
              title="Thông tin cá nhân"
              subtitle="Cập nhật từ tài khoản khách hàng"
              left={(props) => <List.Icon {...props} icon="account-details-outline" />}
              right={(props) => (
                <Button
                  mode="text"
                  compact
                  onPress={() => setDetailsExpanded((prev) => !prev)}
                >
                  {detailsExpanded ? 'Thu gọn' : 'Xem tất cả'}
                </Button>
              )}
            />
            <Card.Content>
              {profileDetails
                .slice(0, detailsExpanded ? profileDetails.length : 5)
                .map((item) => (
                  <View key={item.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{item.label}</Text>
                    <Text style={styles.detailValue}>
                      {item.value === null || item.value === undefined || item.value === ''
                        ? 'Chưa cập nhật'
                        : String(item.value)}
                    </Text>
                  </View>
                ))}
            </Card.Content>
          </Card>
          {menuItems
            .filter((item) => item.key !== 'profile')
            .map((item) => (
              <React.Fragment key={item.key}>
                <List.Item
                  title={item.label}
                  left={(props) => <List.Icon {...props} icon={item.icon as any} />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => {
                    if (item.key === 'address') {
                      navigation.navigate('AddressList' as never);
                    } else if (item.key === 'orders') {
                      navigation.navigate('Orders' as never);
                    }
                  }}
                />
                <Divider />
              </React.Fragment>
            ))}
        </List.Section>
      </ScrollView>
    </View>
      <Snackbar
        visible={logoutSnackbarVisible}
        onDismiss={() => setLogoutSnackbarVisible(false)}
        duration={3000}
      >
        Đăng xuất thành công
      </Snackbar>
    </>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroText: {
    flex: 1,
  },
  email: {
    marginTop: 4,
    color: '#6B6B6B',
  },
  phone: {
    marginTop: 2,
    color: '#6B6B6B',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  chip: {
    backgroundColor: '#FFF3EB',
  },
  logoutButton: {
    marginTop: 16,
    borderRadius: 10,
  },
  loginButton: {
    marginTop: 16,
    borderRadius: 10,
  },
  listSection: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  detailCard: {
    borderRadius: 20,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFEFEF',
    paddingVertical: 10,
  },
  detailLabel: {
    flex: 1,
    fontWeight: '600',
    color: '#6B6B6B',
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    color: '#272727',
  },
});

