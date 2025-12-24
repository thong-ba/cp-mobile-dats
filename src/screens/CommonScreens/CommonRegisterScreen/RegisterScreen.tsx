import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { RegisterForm } from '../../../components/CommonScreenComponents/RegisterComponents';
import { registerCustomer } from '../../../services/authService';
import { CustomerAuthService } from '../../../services/customerAuthService';
import { RegisterRequest } from '../../../types/auth';

const AsyncStorage: any =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@react-native-async-storage/async-storage').default;

/**
 * RegisterScreen Component
 * 
 * Handles customer registration with:
 * - Client-side validation
 * - API error handling (409 conflict, 400 validation)
 * - Success message and redirect to login
 * - Pre-fill email in login screen
 */
export default function RegisterScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    phone?: string;
  }>({});
  const [successVisible, setSuccessVisible] = useState(false);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = useCallback(
    async (payload: RegisterRequest) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      setFieldErrors({});

      try {
        // 1. Client-side validation
        const validationErrors = CustomerAuthService.validateRegisterData(payload);
        if (validationErrors.length > 0) {
          setErrorMessage(validationErrors[0]);
          setIsSubmitting(false);
          return;
        }

        // 2. API call
        const response = await registerCustomer(payload);

        // 3. Success handling
        if (response.status === 201) {
          setSuccessVisible(true);
          
          // Clear timer if exists
          if (successTimerRef.current) {
            clearTimeout(successTimerRef.current);
          }

          // Wait 3 seconds then navigate to login with email pre-filled
          successTimerRef.current = setTimeout(() => {
            setSuccessVisible(false);
            // @ts-ignore - navigation params type
            navigation.navigate('Login', {
              email: (response.data as any)?.email || payload.email,
              message: 'Đăng ký thành công. Vui lòng đăng nhập.',
            });
          }, 3000);
        }
      } catch (error: unknown) {
        // 4. Error handling
        let message = 'Không thể đăng ký. Vui lòng thử lại.';
        const errorObj = error as { status?: number; message?: string; response?: any };

        if (errorObj.status === 409) {
          // Conflict: Email or phone already exists
          const errorMessage = (errorObj.message || '').toLowerCase();
          
          if (errorMessage.includes('email') && 
              (errorMessage.includes('already') || errorMessage.includes('used') || errorMessage.includes('exists'))) {
            setFieldErrors({ email: 'Email này đã được sử dụng' });
            message = 'Email này đã được sử dụng. Vui lòng sử dụng email khác hoặc đăng nhập.';
          } else if ((errorMessage.includes('phone') || errorMessage.includes('số điện thoại')) && 
                     (errorMessage.includes('already') || errorMessage.includes('used') || errorMessage.includes('exists'))) {
            setFieldErrors({ phone: 'Số điện thoại này đã được sử dụng' });
            message = 'Số điện thoại này đã được sử dụng. Vui lòng sử dụng số điện thoại khác.';
          } else {
            message = 'Thông tin đăng ký đã tồn tại trong hệ thống. Vui lòng kiểm tra lại email và số điện thoại.';
          }
        } else if (errorObj.status === 400) {
          // Bad Request: Validation error
          message = CustomerAuthService.formatApiError(errorObj);
        } else {
          // Other errors (network, 500, etc.)
          message = CustomerAuthService.formatApiError(errorObj);
        }

        setErrorMessage(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigation],
  );

  React.useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.headerArea}>
            <Text style={styles.screenTitle}>Đăng ký</Text>
            <Text style={styles.screenSubtitle}>Tạo tài khoản mới chỉ với vài bước đơn giản</Text>
          </View>

          <View style={styles.card}>
            <RegisterForm
              hideTitle
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              onFieldChange={() => {
                setErrorMessage(null);
                setFieldErrors({});
              }}
            />
            <View
              style={{
                marginTop: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Text style={{ color: '#444' }}>Đã có tài khoản?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
                <Text style={{ color: '#FF6A00', fontWeight: '700' }}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
      <Snackbar
        visible={successVisible}
        onDismiss={() => setSuccessVisible(false)}
        duration={3000}
        style={styles.successSnackbar}
      >
        Đăng ký thành công! Hãy kiểm tra email xác nhận đăng ký tài khoản
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  container: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerArea: {
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
  },
  screenSubtitle: {
    marginTop: 6,
    color: '#666',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  successSnackbar: {
    backgroundColor: '#4CAF50',
  },
});
