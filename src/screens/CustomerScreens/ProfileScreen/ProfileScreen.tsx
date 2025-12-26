import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  List,
  Menu,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import {
  updateCustomerProfile,
  UpdateCustomerProfilePayload,
} from '../../../services/customerService';
import { getCustomerOrders } from '../../../services/orderService';
import { CustomerOrder } from '../../../types/order';

const ProfileScreen = () => {
  const { authState, logout, isAuthenticated, updateCustomerProfile: updateProfileInContext } = useAuth();
  const navigation = useNavigation();
  const theme = useTheme();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [logoutSnackbarVisible, setLogoutSnackbarVisible] = useState(false);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [genderMenuVisible, setGenderMenuVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    gender: 'other' as 'male' | 'female' | 'other',
    dateOfBirth: '',
    avatarURL: null as string | null,
  });

  const menuItems = [
    { icon: 'account-outline', label: 'Thông tin cá nhân', key: 'profile' },
    { icon: 'map-marker-outline', label: 'Địa chỉ', key: 'address' },
    { icon: 'shopping-outline', label: 'Đơn hàng của tôi', key: 'orders' },
    { icon: 'cog-outline', label: 'Cài đặt', key: 'settings' },
  ];

  const profile = authState.customerProfile;
  
  // Initialize form data from profile
  useEffect(() => {
    if (profile && !isEditing) {
      setFormData({
        fullName: profile.fullName || '',
        phoneNumber: profile.phoneNumber || '',
        gender: profile.gender === 'MALE' ? 'male' : profile.gender === 'FEMALE' ? 'female' : 'other',
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '', // Convert ISO to yyyy-MM-dd
        avatarURL: profile.avatarURL,
      });
    }
  }, [profile, isEditing]);

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
      { label: 'Số địa chỉ', value: profile.addressCount },
      { label: 'Điểm uy tín', value: profile.legalPoint },
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
      { label: 'Đơn trả', value: stats.returned, icon: 'package-variant' },
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

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    // Reset form to original profile data
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        phoneNumber: profile.phoneNumber || '',
        gender: profile.gender === 'MALE' ? 'male' : profile.gender === 'FEMALE' ? 'female' : 'other',
        dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
        avatarURL: profile.avatarURL,
      });
    }
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;
    
    if (!customerId || !accessToken || !profile) {
      setSnackbarMessage('Không thể cập nhật thông tin. Vui lòng đăng nhập lại.');
      setSnackbarVisible(true);
      return;
    }

    // Validation
    if (!formData.fullName.trim()) {
      setSnackbarMessage('Vui lòng nhập họ và tên.');
      setSnackbarVisible(true);
      return;
    }

    try {
      setIsSaving(true);
      
      // Build payload
      const payload: UpdateCustomerProfilePayload = {
        fullName: formData.fullName.trim(),
        phoneNumber: formData.phoneNumber.trim() || undefined,
        gender: formData.gender === 'male' ? 'MALE' : formData.gender === 'female' ? 'FEMALE' : null,
        dateOfBirth: formData.dateOfBirth || null,
        avatarURL: formData.avatarURL,
        // Keep existing values for fields that shouldn't change
        userName: profile.userName,
        email: profile.email,
        status: profile.status as any,
        twoFactorEnabled: profile.twoFactorEnabled,
        kycStatus: profile.kycStatus as any,
        preferredCategory: profile.preferredCategory,
      };

      const updatedProfile = await updateCustomerProfile({
        customerId,
        accessToken,
        payload,
      });

      // Update context
      updateProfileInContext(updatedProfile);

      setSnackbarMessage('Cập nhật thông tin thành công');
      setSnackbarVisible(true);
      setIsEditing(false);
    } catch (error: any) {
      console.error('[ProfileScreen] Failed to update profile:', error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Không thể cập nhật thông tin. Vui lòng thử lại.';
      setSnackbarMessage(errorMessage);
      setSnackbarVisible(true);
    } finally {
      setIsSaving(false);
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
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {isEditing ? (
                    <>
                      <Button
                        mode="text"
                        compact
                        onPress={handleCancelEdit}
                        disabled={isSaving}
                      >
                        Hủy
                      </Button>
                      <Button
                        mode="contained"
                        compact
                        onPress={handleSaveProfile}
                        loading={isSaving}
                        disabled={isSaving}
                      >
                        Lưu
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        mode="text"
                        compact
                        onPress={handleStartEdit}
                      >
                        Cập nhật
                      </Button>
                      <Button
                        mode="text"
                        compact
                        onPress={() => setDetailsExpanded((prev) => !prev)}
                      >
                        {detailsExpanded ? 'Thu gọn' : 'Xem tất cả'}
                      </Button>
                    </>
                  )}
                </View>
              )}
            />
            <Card.Content>
              {isEditing ? (
                <View style={styles.editForm}>
                  <TextInput
                    label="Họ và tên *"
                    value={formData.fullName}
                    onChangeText={(text: string) => setFormData({ ...formData, fullName: text })}
                    mode="outlined"
                    style={styles.input}
                  />
                  <TextInput
                    label="Số điện thoại"
                    value={formData.phoneNumber}
                    onChangeText={(text: string) => setFormData({ ...formData, phoneNumber: text })}
                    mode="outlined"
                    keyboardType="phone-pad"
                    style={styles.input}
                  />
                  <Menu
                    visible={genderMenuVisible}
                    onDismiss={() => setGenderMenuVisible(false)}
                    anchor={
                      <TextInput
                        label="Giới tính"
                        value={
                          formData.gender === 'male'
                            ? 'Nam'
                            : formData.gender === 'female'
                              ? 'Nữ'
                              : 'Khác'
                        }
                        mode="outlined"
                        editable={false}
                        right={<TextInput.Icon icon="chevron-down" />}
                        onPressIn={() => setGenderMenuVisible(true)}
                        style={styles.input}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => {
                        setFormData({ ...formData, gender: 'male' });
                        setGenderMenuVisible(false);
                      }}
                      title="Nam"
                    />
                    <Menu.Item
                      onPress={() => {
                        setFormData({ ...formData, gender: 'female' });
                        setGenderMenuVisible(false);
                      }}
                      title="Nữ"
                    />
                    <Menu.Item
                      onPress={() => {
                        setFormData({ ...formData, gender: 'other' });
                        setGenderMenuVisible(false);
                      }}
                      title="Khác"
                    />
                  </Menu>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={styles.dateInputContainer}
                  >
                    <TextInput
                      label="Ngày sinh"
                      value={
                        formData.dateOfBirth
                          ? new Date(formData.dateOfBirth).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : ''
                      }
                      mode="outlined"
                      placeholder="Chọn ngày sinh"
                      editable={false}
                      right={<TextInput.Icon icon="calendar" />}
                      style={styles.input}
                    />
                  </TouchableOpacity>
                  <Portal>
                    <Modal
                      visible={showDatePicker}
                      onDismiss={() => setShowDatePicker(false)}
                      contentContainerStyle={styles.datePickerModal}
                      dismissable={true}
                      dismissableBackButton={true}
                    >
                      <View style={styles.datePickerContent}>
                        <Text variant="titleLarge" style={styles.datePickerTitle}>
                          Chọn ngày sinh
                        </Text>
                        {Platform.OS === 'web' ? (
                          <View style={styles.simpleDatePicker}>
                            <TextInput
                              label="Ngày sinh (yyyy-MM-dd)"
                              value={formData.dateOfBirth}
                              onChangeText={(text: string) => {
                                setFormData({ ...formData, dateOfBirth: text });
                              }}
                              mode="outlined"
                              placeholder="yyyy-MM-dd"
                              keyboardType="numeric"
                            />
                          </View>
                        ) : (
                          <View style={styles.datePickerWrapper}>
                            <Text style={styles.datePickerHint}>
                              Vui lòng chọn ngày từ calendar
                            </Text>
                          </View>
                        )}
                        {Platform.OS === 'ios' && (
                          <View style={styles.datePickerActions}>
                            <Button onPress={() => setShowDatePicker(false)}>Hủy</Button>
                            <Button
                              mode="contained"
                              onPress={() => {
                                // Validate date format
                                if (formData.dateOfBirth) {
                                  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                                  if (dateRegex.test(formData.dateOfBirth)) {
                                    const date = new Date(formData.dateOfBirth);
                                    if (!isNaN(date.getTime()) && date <= new Date()) {
                                      setShowDatePicker(false);
                                    } else {
                                      setSnackbarMessage('Ngày không hợp lệ hoặc trong tương lai');
                                      setSnackbarVisible(true);
                                    }
                                  } else {
                                    setSnackbarMessage('Vui lòng nhập đúng định dạng yyyy-MM-dd');
                                    setSnackbarVisible(true);
                                  }
                                } else {
                                  setShowDatePicker(false);
                                }
                              }}
                            >
                              Xác nhận
                            </Button>
                          </View>
                        )}
                        {Platform.OS === 'web' && (
                          <View style={styles.datePickerActions}>
                            <Button onPress={() => setShowDatePicker(false)}>Hủy</Button>
                            <Button
                              mode="contained"
                              onPress={() => {
                                // Validate date format
                                if (formData.dateOfBirth) {
                                  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                                  if (dateRegex.test(formData.dateOfBirth)) {
                                    const date = new Date(formData.dateOfBirth);
                                    if (!isNaN(date.getTime()) && date <= new Date()) {
                                      setShowDatePicker(false);
                                    } else {
                                      setSnackbarMessage('Ngày không hợp lệ hoặc trong tương lai');
                                      setSnackbarVisible(true);
                                    }
                                  } else {
                                    setSnackbarMessage('Vui lòng nhập đúng định dạng yyyy-MM-dd');
                                    setSnackbarVisible(true);
                                  }
                                } else {
                                  setShowDatePicker(false);
                                }
                              }}
                            >
                              Xác nhận
                            </Button>
                          </View>
                        )}
                      </View>
                    </Modal>
                  </Portal>
                  <Text variant="bodySmall" style={styles.emailWarning}>
                    Email không thể thay đổi. Vui lòng liên hệ CSKH nếu bạn cần cập nhật email.
                  </Text>
                </View>
              ) : (
                profileDetails
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
                  ))
              )}
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
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
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
  editForm: {
    gap: 16,
  },
  input: {
    marginBottom: 8,
  },
  emailWarning: {
    color: '#FF6A00',
    marginTop: 8,
    fontStyle: 'italic',
  },
  genderButton: {
    width: '100%',
  },
  dateInputContainer: {
    width: '100%',
  },
  datePickerModal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
  },
  datePickerContent: {
    gap: 16,
  },
  datePickerTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  datePickerWrapper: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerHint: {
    color: '#666',
    textAlign: 'center',
  },
  simpleDatePicker: {
    gap: 8,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
});

