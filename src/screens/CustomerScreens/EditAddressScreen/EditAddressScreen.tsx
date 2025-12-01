import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { AddressForm } from '../../../components/CustomerScreenComponents/AddressComponents';
import { useAuth } from '../../../context/AuthContext';
import { CustomerStackParamList } from '../../../navigation/CustomerStackNavigator';
import { updateCustomerAddress } from '../../../services/customerService';
import { CreateCustomerAddressPayload, CustomerAddress } from '../../../types/customer';

const ORANGE = '#FF6A00';

type EditAddressRouteProp = RouteProp<CustomerStackParamList, 'EditAddress'>;

const toFormPayload = (address: CustomerAddress): CreateCustomerAddressPayload => ({
  receiverName: address.receiverName,
  phoneNumber: address.phoneNumber,
  label: address.label,
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
  isDefault: address.default,
});

const EditAddressScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<EditAddressRouteProp>();
  const { authState } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { address } = route.params;

  const handleSubmit = async (payload: CreateCustomerAddressPayload) => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;

    if (!customerId || !accessToken) {
      setErrorMessage('Không tìm thấy thông tin khách hàng. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await updateCustomerAddress({
        customerId,
        addressId: address.id,
        accessToken,
        payload,
      });
      console.log('[EditAddressScreen] address updated successfully');
      setSuccessVisible(true);
      setTimeout(() => {
        setSuccessVisible(false);
        navigation.goBack();
      }, 1500);
    } catch (error: any) {
      console.log('[EditAddressScreen] update address failed', error);
      const message =
        error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.response?.status === 404
          ? 'Địa chỉ không tồn tại'
          : error?.response?.status === 400
          ? error?.response?.data?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'
          : error?.message?.includes('Network')
          ? 'Không có kết nối mạng. Vui lòng thử lại.'
          : 'Không thể cập nhật địa chỉ. Vui lòng thử lại.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chỉnh sửa địa chỉ</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
          <AddressForm onSubmit={handleSubmit} isSubmitting={isSubmitting} initialValues={toFormPayload(address)} />
        </ScrollView>
      </SafeAreaView>
      <Snackbar
        visible={successVisible}
        onDismiss={() => setSuccessVisible(false)}
        duration={2000}
      >
        Địa chỉ đã được cập nhật thành công
      </Snackbar>
    </>
  );
};

export default EditAddressScreen;

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
  placeholder: {
    width: 30,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  errorContainer: {
    margin: 16,
    padding: 12,
    backgroundColor: '#FFECEC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFB4AB',
  },
  errorText: {
    color: '#B3261E',
    fontSize: 14,
  },
});


