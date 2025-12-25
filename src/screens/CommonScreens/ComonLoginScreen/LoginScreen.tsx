import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Snackbar } from 'react-native-paper';
import { LoginForm } from '../../../components/CommonScreenComponents/LoginComponents';
import { useAuth } from '../../../context/AuthContext';
import { forgotPassword, resendVerifyEmail } from '../../../services/authService';
import { CustomerAuthService } from '../../../services/customerAuthService';
import { LoginRequest } from '../../../types/auth';

const AsyncStorage: any =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@react-native-async-storage/async-storage').default;

const WELCOME_MESSAGE_STORAGE_KEY = 'welcomeMessage';
const REDIRECT_AFTER_LOGIN_KEY = 'redirectAfterLogin';
const RESEND_COOLDOWN_STORAGE_KEY = 'resendVerifyEmailCooldown';
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * LoginScreen Component
 * 
 * Handles customer login with:
 * - Form validation
 * - API error handling
 * - Token storage
 * - Welcome message setup
 * - Redirect handling
 */
export default function LoginScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState<string>('');
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Snackbar state cho resend verify email
  const [resendSnackbarVisible, setResendSnackbarVisible] = useState(false);
  const [resendSnackbarMessage, setResendSnackbarMessage] = useState('');
  const [resendSnackbarType, setResendSnackbarType] = useState<'success' | 'error'>('success');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Resend Verify Email State
  const [resendCooldown, setResendCooldown] = useState(0);
  const [currentEmail, setCurrentEmail] = useState('');

  // Load cooldown from storage on mount
  useEffect(() => {
    const loadCooldown = async () => {
      try {
        const saved = await AsyncStorage.getItem(RESEND_COOLDOWN_STORAGE_KEY);
        if (saved) {
          const savedTime = parseInt(saved, 10);
          const now = Date.now();
          const diff = Math.floor((savedTime - now) / 1000);
          if (diff > 0) {
            setResendCooldown(diff);
          } else {
            // Cooldown expired, clear storage
            await AsyncStorage.removeItem(RESEND_COOLDOWN_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.warn('[LoginScreen] Failed to load cooldown:', error);
      }
    };
    loadCooldown();
  }, []);

  // Countdown timer cho resend verify email
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Cooldown expired, clear storage
      AsyncStorage.removeItem(RESEND_COOLDOWN_STORAGE_KEY).catch(() => {});
    }
  }, [resendCooldown]);

  // Pre-fill email from route params (from register screen)
  useEffect(() => {
    const params = route.params as { email?: string; message?: string } | undefined;
    if (params?.email) {
      setPrefillEmail(params.email);
      setCurrentEmail(params.email);
      if (params.message) {
        setErrorMessage(null);
        // Show success message if coming from register
        setSuccessVisible(true);
        setTimeout(() => setSuccessVisible(false), 3000);
      }
    }
  }, [route.params]);

  const handleSubmit = useCallback(
    async ({ email, password }: LoginRequest) => {
      // 1. Validation
      if (!email || !email.trim()) {
        setErrorMessage('Email là bắt buộc');
        return;
      }

      if (!password || !password.trim()) {
        setErrorMessage('Mật khẩu là bắt buộc');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        // 2. API call
        const response = await login({ email: email.trim(), password });

        // 3. Success handling
        if (response) {
          const user = response.user;
          const displayName = user?.fullName || 'người dùng';

          // 4. Check redirect URL
          const redirectUrl = await AsyncStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);

          if (redirectUrl) {
            // Clear saved URL
            await AsyncStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
            // Navigate back to previous page (không hiển thị welcome popup)
            navigation.navigate(redirectUrl as never);
          } else {
            // 5. Set welcome message for HomePage
            await AsyncStorage.setItem(
              WELCOME_MESSAGE_STORAGE_KEY,
              JSON.stringify({
                userName: displayName,
                showWelcome: true,
              }),
            );

            // 6. Show success message
            setSuccessVisible(true);
            if (successTimerRef.current) {
              clearTimeout(successTimerRef.current);
            }

            // 7. Navigate to Home after 2 seconds
            successTimerRef.current = setTimeout(() => {
              setSuccessVisible(false);
              const tabNavigator = navigation.getParent();
              tabNavigator?.navigate('Home' as never);
            }, 2000);
          }
        }
      } catch (error: unknown) {
        // 8. Error handling
        const errorObj = error as { status?: number; message?: string; response?: any };
        const errorMessage = CustomerAuthService.formatApiError(errorObj);
        setErrorMessage(errorMessage);
      } finally {
        setIsSubmitting(false);
      }
    },
    [login, navigation],
  );

  /**
   * Xử lý quên mật khẩu
   */
  const handleForgotPassword = useCallback(async () => {
    // Validate email
    if (!forgotEmail.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email.');
      return;
    }

    try {
      setIsSendingReset(true);
      const res = await forgotPassword(forgotEmail.trim());

      if (res.status === 200) {
        Alert.alert(
          'Thành công',
          res.message || 'Kiểm tra email của bạn để đặt lại mật khẩu.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowForgotModal(false);
                setForgotEmail('');
              },
            },
          ],
        );
      } else {
        // Xử lý lỗi 404 đặc biệt
        if (res.status === 404) {
          Alert.alert('Lỗi', 'Email không tồn tại trong hệ thống');
        } else {
          Alert.alert('Lỗi', res.message || 'Không thể gửi email reset. Vui lòng thử lại.');
        }
      }
    } catch (error: any) {
      const errorMessage =
        error?.message || 'Lỗi kết nối. Vui lòng kiểm tra internet.';
      Alert.alert('Lỗi', errorMessage);
    } finally {
      setIsSendingReset(false);
    }
  }, [forgotEmail]);

  /**
   * Xử lý gửi lại email xác nhận
   */
  const handleResendVerifyEmail = useCallback(async () => {
    // Kiểm tra cooldown
    if (resendCooldown > 0) {
      return; // Đang trong cooldown, không cho phép gửi
    }

    // Validate email
    const emailToUse = currentEmail.trim() || prefillEmail.trim();
    if (!emailToUse) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập email vào ô email.');
      return;
    }

    try {
      console.log('[LoginScreen] Calling resendVerifyEmail with email:', emailToUse);
      const res = await resendVerifyEmail(emailToUse, 'CUSTOMER');
      console.log('[LoginScreen] resendVerifyEmail response:', res);

      if (res.status === 200) {
        // Set cooldown ngay lập tức
        const expiryTime = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        
        // Lưu vào storage (async, không block)
        AsyncStorage.setItem(RESEND_COOLDOWN_STORAGE_KEY, expiryTime.toString()).catch((err: unknown) => {
          console.warn('[LoginScreen] Failed to save cooldown:', err);
        });

        // Hiển thị thông báo thành công
        const successMsg = res.message || 'Đã gửi lại email xác nhận thành công';
        console.log('[LoginScreen] Showing success alert:', successMsg);
        Alert.alert('Thành công', successMsg);
        
        // Cũng hiển thị Snackbar để đảm bảo user thấy thông báo
        setResendSnackbarMessage(successMsg);
        setResendSnackbarType('success');
        setResendSnackbarVisible(true);
      } else {
        // Xử lý lỗi 404 đặc biệt
        let errorMsg = '';
        if (res.status === 404) {
          errorMsg = 'Tài khoản không tồn tại';
        } else {
          errorMsg = res.message || 'Không thể gửi lại email xác nhận';
        }
        console.log('[LoginScreen] Showing error alert:', errorMsg, 'Status:', res.status);
        Alert.alert('Lỗi', errorMsg);
        
        // Cũng hiển thị Snackbar để đảm bảo user thấy thông báo
        setResendSnackbarMessage(errorMsg);
        setResendSnackbarType('error');
        setResendSnackbarVisible(true);
      }
    } catch (error: any) {
      console.error('[LoginScreen] resendVerifyEmail error:', error);
      // Kiểm tra nếu lỗi có status 404
      let errorMsg = '';
      if (error?.status === 404) {
        errorMsg = 'Tài khoản không tồn tại';
      } else {
        errorMsg = error?.message || 'Lỗi kết nối. Vui lòng kiểm tra internet.';
      }
      console.log('[LoginScreen] Showing catch error alert:', errorMsg);
      Alert.alert('Lỗi', errorMsg);
      
      // Cũng hiển thị Snackbar để đảm bảo user thấy thông báo
      setResendSnackbarMessage(errorMsg);
      setResendSnackbarType('error');
      setResendSnackbarVisible(true);
    }
  }, [currentEmail, prefillEmail, resendCooldown]);

  /**
   * Mở modal quên mật khẩu với email hiện tại
   */
  const handleOpenForgotPassword = useCallback(() => {
    const emailToUse = currentEmail.trim() || prefillEmail.trim();
    setForgotEmail(emailToUse);
    setShowForgotModal(true);
  }, [currentEmail, prefillEmail]);

  useEffect(() => {
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
            <Text style={styles.screenTitle}>Đăng nhập</Text>
            {/* <Text style={styles.screenSubtitle}>Chào mừng trở lại, hãy tiếp tục với một phương thức phù hợp</Text> */}
          </View>

          <View style={styles.card}>
            <LoginForm
              hideTitle
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              initialEmail={prefillEmail}
              onForgotPassword={handleOpenForgotPassword}
              onResendVerifyEmail={handleResendVerifyEmail}
              resendCooldown={resendCooldown}
              onEmailChange={setCurrentEmail}
            />
            <View style={{ marginTop: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <Text style={{ color: '#444' }}>Chưa có tài khoản?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register' as never)}>
                <Text style={{ color: '#FF6A00', fontWeight: '700' }}>Tạo tài khoản</Text>
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
        Đăng nhập thành công
      </Snackbar>

      {/* Resend Verify Email Snackbar */}
      <Snackbar
        visible={resendSnackbarVisible}
        onDismiss={() => setResendSnackbarVisible(false)}
        duration={4000}
        style={resendSnackbarType === 'success' ? styles.successSnackbar : styles.errorSnackbar}
      >
        {resendSnackbarMessage}
      </Snackbar>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowForgotModal(false);
          setForgotEmail('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              if (!isSendingReset) {
                setShowForgotModal(false);
                setForgotEmail('');
              }
            }}
          >
            <View style={styles.modalContentContainer}>
              <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Quên mật khẩu</Text>
                  <Text style={styles.modalDescription}>
                    Nhập email của bạn để nhận link đặt lại mật khẩu.
                  </Text>

                  <View style={styles.modalInputContainer}>
                    <Text style={styles.modalLabel}>Email</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Nhập email"
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSendingReset}
                    />
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => {
                        setShowForgotModal(false);
                        setForgotEmail('');
                      }}
                      disabled={isSendingReset}
                    >
                      <Text style={styles.modalButtonCancelText}>Hủy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonSubmit, isSendingReset && styles.modalButtonDisabled]}
                      onPress={handleForgotPassword}
                      disabled={isSendingReset}
                    >
                      {isSendingReset ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalButtonSubmitText}>Gửi email reset</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
  errorSnackbar: {
    backgroundColor: '#B3261E',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalInputContainer: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  modalButtonCancelText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonSubmit: {
    backgroundColor: '#FF6A00',
  },
  modalButtonSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
});
