import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Snackbar } from 'react-native-paper';
import { LoginForm } from '../../../components/CommonScreenComponents/LoginComponents';
import { useAuth } from '../../../context/AuthContext';
import { LoginRequest } from '../../../types/auth';

export default function LoginScreen() {
  const navigation = useNavigation();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successVisible, setSuccessVisible] = useState(false);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = useCallback(async ({ email, password }: LoginRequest) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await login({ email, password });
      console.log('[LoginScreen] login succeeded');
      setSuccessVisible(true);
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      successTimerRef.current = setTimeout(() => {
        setSuccessVisible(false);
        const tabNavigator = navigation.getParent();
        tabNavigator?.navigate('Home' as never);
      }, 3000);
    } catch (error: unknown) {
      console.log('[LoginScreen] login failed', error);
      let message = 'Không thể đăng nhập. Vui lòng thử lại.';
      if (typeof error === 'object' && error !== null) {
        const maybeMessage = (error as { message?: string }).message;
        if (maybeMessage) {
          message = maybeMessage;
        }
        const axiosResponseMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (axiosResponseMessage) {
          message = axiosResponseMessage;
        }
      }
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

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
          <LoginForm hideTitle onSubmit={handleSubmit} isSubmitting={isSubmitting} errorMessage={errorMessage} />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>Hoặc tiếp tục với</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={[styles.socialButton, styles.googleButton]} onPress={() => {}}>
            <MaterialCommunityIcons name="google" size={22} color="#DB4437" />
            <Text style={[styles.socialText, { color: '#DB4437' }]}>Tiếp tục với Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.socialButton, styles.githubButton]} onPress={() => {}}>
            <MaterialCommunityIcons name="github" size={22} color="#000000" />
            <Text style={[styles.socialText, { color: '#000000' }]}>Tiếp tục với GitHub</Text>
          </TouchableOpacity>
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
  socialButton: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  googleButton: {},
  githubButton: {},
  socialText: {
    fontSize: 15,
    fontWeight: '700',
  },
  dividerRow: {
    marginVertical: 6,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEE',
  },
  dividerText: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
  },
});


