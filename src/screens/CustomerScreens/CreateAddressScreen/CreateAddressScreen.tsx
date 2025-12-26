import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { AddressForm } from '../../../components/CustomerScreenComponents/AddressComponents';
import { useAuth } from '../../../context/AuthContext';
import { createCustomerAddress } from '../../../services/customerService';
import { CreateCustomerAddressPayload } from '../../../types/customer';

const ORANGE = '#FF6A00';

const CreateAddressScreen: React.FC = () => {
  const navigation = useNavigation();
  const { authState } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (payload: CreateCustomerAddressPayload) => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;

    if (!customerId || !accessToken) {
      setErrorMessage('Không tìm thấy thông tin khách hàng. Vui lòng đăng nhập lại.');
      return;
    }

    // Validate các trường bắt buộc trước khi gọi API (theo tài liệu)
    if (!payload.receiverName.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ thông tin địa chỉ: Tên người nhận là bắt buộc.');
      return;
    }

    if (!payload.phoneNumber.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ thông tin địa chỉ: Số điện thoại là bắt buộc.');
      return;
    }

    if (!payload.province || !payload.district || !payload.ward) {
      setErrorMessage('Vui lòng điền đầy đủ thông tin địa chỉ: Tỉnh/Quận/Phường là bắt buộc.');
      return;
    }

    if (!payload.street.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ thông tin địa chỉ: Tên đường là bắt buộc.');
      return;
    }

    // Validate mã địa lý (theo tài liệu)
    if (!payload.provinceCode || payload.provinceCode.trim() === '') {
      setErrorMessage('Thiếu mã địa lý: vui lòng chọn Tỉnh/Quận/Phường hợp lệ.');
      return;
    }

    if (!payload.districtId || payload.districtId === 0) {
      setErrorMessage('Thiếu mã địa lý: vui lòng chọn Tỉnh/Quận/Phường hợp lệ.');
      return;
    }

    if (!payload.wardCode || payload.wardCode.trim() === '') {
      setErrorMessage('Thiếu mã địa lý: vui lòng chọn Tỉnh/Quận/Phường hợp lệ.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      console.log('[CreateAddressScreen] Creating address with payload:', JSON.stringify(payload, null, 2));
      const result = await createCustomerAddress({ customerId, accessToken, payload });
      console.log('[CreateAddressScreen] address created successfully:', result);
      setSuccessVisible(true);
      // Navigate back after 1.5s (theo tài liệu: reload danh sách, reset form, đóng form)
      setTimeout(() => {
        setSuccessVisible(false);
        navigation.goBack();
      }, 1500);
    } catch (error: any) {
      console.error('[CreateAddressScreen] create address failed:', error);
      console.error('[CreateAddressScreen] error response:', error?.response?.data);
      console.error('[CreateAddressScreen] error status:', error?.response?.status);
      // Error handling theo tài liệu
      let message = 'Thêm địa chỉ thất bại';
      
      if (error?.response?.status === 401) {
        message = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      } else if (error?.response?.status === 400) {
        message = error?.response?.data?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
      } else if (error?.response?.status === 422) {
        message = error?.response?.data?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
      } else if (error?.message?.includes('Network') || error?.code === 'NETWORK_ERROR') {
        message = 'Không có kết nối mạng. Vui lòng thử lại.';
      } else if (error?.response?.data?.message) {
        message = error.response.data.message;
      }
      
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
          <Text style={styles.headerTitle}>Thêm địa chỉ mới</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}
          <AddressForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </ScrollView>
      </SafeAreaView>
      <Snackbar
        visible={successVisible}
        onDismiss={() => setSuccessVisible(false)}
        duration={2000}
      >
        Địa chỉ đã được thêm thành công
      </Snackbar>
    </>
  );
};

export default CreateAddressScreen;

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

