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

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await createCustomerAddress({ customerId, accessToken, payload });
      console.log('[CreateAddressScreen] address created successfully');
      setSuccessVisible(true);
      // Navigate back after 1.5s
      setTimeout(() => {
        setSuccessVisible(false);
        navigation.goBack();
      }, 1500);
    } catch (error: any) {
      console.log('[CreateAddressScreen] create address failed', error);
      const message =
        error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.response?.status === 400
          ? error?.response?.data?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.'
          : error?.message?.includes('Network')
          ? 'Không có kết nối mạng. Vui lòng thử lại.'
          : 'Không thể tạo địa chỉ. Vui lòng thử lại.';
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

