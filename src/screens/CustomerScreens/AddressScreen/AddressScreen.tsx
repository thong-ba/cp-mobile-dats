import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Dialog, Portal, Snackbar } from 'react-native-paper';
import { AddressList } from '../../../components/CustomerScreenComponents/AddressComponents';
import { useAuth } from '../../../context/AuthContext';
import {
    deleteCustomerAddress,
    getCustomerAddresses,
    updateCustomerAddress,
} from '../../../services/customerService';
import { CreateCustomerAddressPayload, CustomerAddress } from '../../../types/customer';

const ORANGE = '#FF6A00';

const AddressScreen: React.FC = () => {
  const navigation = useNavigation();
  const { authState } = useAuth();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<CustomerAddress | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAddresses = useCallback(
    async (isPullRefresh = false) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;

      if (!customerId || !accessToken) {
        setErrorMessage('Không tìm thấy thông tin khách hàng. Vui lòng đăng nhập lại.');
        return;
      }

      try {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);
        const data = await getCustomerAddresses({ customerId, accessToken });
        setAddresses(data);
      } catch (error: any) {
        console.log('[AddressScreen] loadAddresses failed', error);
        const message =
          error?.response?.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : error?.message?.includes('Network')
            ? 'Không có kết nối mạng. Vui lòng thử lại.'
            : 'Không thể tải danh sách địa chỉ. Vui lòng thử lại.';
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

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  // Refresh when screen comes into focus (e.g., returning from CreateAddress)
  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses]),
  );

  const handleDeleteAddress = (address: CustomerAddress) => {
    setAddressToDelete(address);
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    if (!addressToDelete) return;

    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;

    if (!customerId || !accessToken) {
      setSnackbarMessage('Không tìm thấy thông tin khách hàng. Vui lòng đăng nhập lại.');
      setSnackbarVisible(true);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteCustomerAddress({
        customerId,
        addressId: addressToDelete.id,
        accessToken,
      });
      setSnackbarMessage('Địa chỉ đã được xóa thành công');
      setSnackbarVisible(true);
      setDeleteDialogVisible(false);
      setAddressToDelete(null);
      // Reload addresses
      await loadAddresses();
    } catch (error: any) {
      console.log('[AddressScreen] delete address failed', error);
      const message =
        error?.response?.status === 404
          ? 'Địa chỉ không tồn tại'
          : error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.message?.includes('Network')
          ? 'Không có kết nối mạng. Vui lòng thử lại.'
          : 'Không thể xóa địa chỉ. Vui lòng thử lại.';
      setSnackbarMessage(message);
      setSnackbarVisible(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefaultAddress = async (address: CustomerAddress) => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;

    if (!customerId || !accessToken) {
      setSnackbarMessage('Không tìm thấy thông tin khách hàng. Vui lòng đăng nhập lại.');
      setSnackbarVisible(true);
      return;
    }

    try {
      const payload: CreateCustomerAddressPayload = {
        receiverName: address.receiverName,
        phoneNumber: address.phoneNumber,
        label: address.label as 'HOME' | 'WORK' | 'OTHER',
        country: address.country,
        province: address.province,
        district: address.district,
        ward: address.ward,
        street: address.street,
        addressLine: address.addressLine,
        postalCode: address.postalCode,
        note: address.note,
        provinceCode: address.provinceCode,
        districtId: address.districtId,
        wardCode: address.wardCode,
        lat: address.lat,
        lng: address.lng,
        isDefault: true,
      };

      await updateCustomerAddress({
        customerId,
        addressId: address.id,
        accessToken,
        payload,
      });
      setSnackbarMessage('Đã đặt làm địa chỉ mặc định');
      setSnackbarVisible(true);
      await loadAddresses();
    } catch (error: any) {
      console.log('[AddressScreen] set default address failed', error);
      const message =
        error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.message?.includes('Network')
          ? 'Không có kết nối mạng. Vui lòng thử lại.'
          : 'Không thể đặt địa chỉ mặc định. Vui lòng thử lại.';
      setSnackbarMessage(message);
      setSnackbarVisible(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Địa chỉ của tôi</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateAddress' as never)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading && !errorMessage ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.loaderText}>Đang tải danh sách địa chỉ...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              // trigger lại effect bằng cách cập nhật state dependency "ảo"
              // hoặc đơn giản gọi lại logic ở đây
              const customerId = authState.decodedToken?.customerId;
              const accessToken = authState.accessToken;
              if (!customerId || !accessToken) {
                return;
              }
              setIsLoading(true);
              setErrorMessage(null);
              getCustomerAddresses({ customerId, accessToken })
                .then(setAddresses)
                .catch((error) => {
                  console.log('[AddressScreen] retry loadAddresses failed', error);
                  setErrorMessage('Không thể tải danh sách địa chỉ. Vui lòng thử lại.');
                })
                .finally(() => setIsLoading(false));
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => loadAddresses(true)} />
          }
        >
          <AddressList
            addresses={addresses}
            onPressAddress={(address) => {
              // @ts-ignore - navigate param type handled in CustomerStackParamList
              navigation.navigate('EditAddress', { address });
            }}
            onDeleteAddress={handleDeleteAddress}
            onSetDefaultAddress={handleSetDefaultAddress}
          />
        </ScrollView>
      )}

      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>Xác nhận xóa</Dialog.Title>
          <Dialog.Content>
            <Text>
              Bạn có chắc chắn muốn xóa địa chỉ "{addressToDelete?.receiverName}" không? Hành động
              này không thể hoàn tác.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <TouchableOpacity
              onPress={() => {
                setDeleteDialogVisible(false);
                setAddressToDelete(null);
              }}
              style={styles.dialogButton}
            >
              <Text style={styles.dialogCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmDelete}
              disabled={isDeleting}
              style={[styles.dialogButton, isDeleting && { opacity: 0.6 }]}
            >
              <Text style={styles.dialogConfirmText}>
                {isDeleting ? 'Đang xóa...' : 'Xóa'}
              </Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

export default AddressScreen;

const styles = StyleSheet.create({
  safe: {
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
  },
  addButton: {
    padding: 4,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#555',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    textAlign: 'center',
    color: '#B3261E',
    marginBottom: 16,
    fontWeight: '600',
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
  dialogButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dialogCancelText: {
    color: '#666',
    fontWeight: '600',
  },
  dialogConfirmText: {
    color: '#B3261E',
    fontWeight: '700',
  },
});


