import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { LoginForm } from '../../../components/CommonScreenComponents/LoginComponents';
import { useAuth } from '../../../context/AuthContext';
import { CustomerAuthService } from '../../../services/customerAuthService';
import { LoginRequest } from '../../../types/auth';

const AsyncStorage: any =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@react-native-async-storage/async-storage').default;

const WELCOME_MESSAGE_STORAGE_KEY = 'welcomeMessage';
const REDIRECT_AFTER_LOGIN_KEY = 'redirectAfterLogin';

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

  // Pre-fill email from route params (from register screen)
  useEffect(() => {
    const params = route.params as { email?: string; message?: string } | undefined;
    if (params?.email) {
      setPrefillEmail(params.email);
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
