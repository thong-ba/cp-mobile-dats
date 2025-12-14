import { CommonActions, useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Chip, Divider, List, Snackbar, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';

const ProfileScreen = () => {
  const { authState, logout, isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const theme = useTheme();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [logoutSnackbarVisible, setLogoutSnackbarVisible] = useState(false);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!profile) {
      return [];
    }
    return [
      { label: 'Tổng đơn', value: profile.orderCount || 0, icon: 'shopping-outline' },
      { label: 'Đơn hủy', value: profile.cancelCount || 0, icon: 'cancel' },
      { label: 'Đơn trả', value: profile.returnCount || 0, icon: 'package-variant-return' },
      { label: 'Chưa thanh toán', value: profile.unpaidOrderCount || 0, icon: 'credit-card-off-outline' },
    ];
  }, [profile]);

  useEffect(
    () => () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    },
    [],
  );

  const handleLogout = () => {
    console.log('[ProfileScreen] logout requested');
    setLogoutSnackbarVisible(true);
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    logoutTimerRef.current = setTimeout(async () => {
      setLogoutSnackbarVisible(false);
      try {
        await logout();
        console.log('[ProfileScreen] logout succeeded');
        const parentNavigator = navigation.getParent();
        parentNavigator?.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Home' as never }],
          }),
        );
      } catch (error) {
        console.log('[ProfileScreen] logout failed', error);
      }
    }, 3000);
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
            {isAuthenticated && profile && (
              <>
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

