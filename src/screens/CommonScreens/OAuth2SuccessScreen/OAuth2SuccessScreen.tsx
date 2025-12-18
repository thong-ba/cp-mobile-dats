import { useNavigation } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { extractOAuthParams } from '../../../services/googleAuthService';

export default function OAuth2SuccessScreen() {
  const navigation = useNavigation();
  const { loginWithGoogle } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let subscription: ReturnType<typeof Linking.addEventListener> | null = null;

    const handleOAuthCallback = async () => {
      try {
        // Get URL from deep link
        let url = '';

        // Try to get initial URL (when app opened via deep link)
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          url = initialUrl;
        }

        // Also listen for URL changes while on this screen
        if (!subscription) {
          subscription = Linking.addEventListener('url', (event: { url: string }) => {
            if (event.url && !url) {
              url = event.url;
              handleOAuthCallback();
            }
          });
        }

        console.log('[OAuth2SuccessScreen] Processing OAuth callback', { url });

        if (!url) {
          setErrorMessage('Không nhận được thông tin từ OAuth callback');
          setStatus('error');
          setTimeout(() => {
            navigation.navigate('Login' as never);
          }, 3000);
          return;
        }

        // Extract OAuth parameters from URL
        const params = extractOAuthParams(url);

        // Check for error
        if (params.error) {
          setErrorMessage(`Đăng nhập Google thất bại: ${params.error}`);
          setStatus('error');
          setTimeout(() => {
            navigation.navigate('Login' as never);
          }, 3000);
          return;
        }

        // Validate required parameters
        const token = params.token || params.accessToken;
        if (!token || !params.accountId) {
          const missingParams = [];
          if (!token) missingParams.push('token');
          if (!params.accountId) missingParams.push('accountId');

          setErrorMessage(
            `Không nhận được thông tin xác thực từ server. Thiếu: ${missingParams.join(', ')}`,
          );
          setStatus('error');
          setTimeout(() => {
            navigation.navigate('Login' as never);
          }, 3000);
          return;
        }

        // Login with Google tokens
        await loginWithGoogle({
          token,
          refreshToken: params.refreshToken,
          accountId: params.accountId,
          customerId: params.customerId,
        });

        setStatus('success');

        // Navigate to home after short delay
        setTimeout(() => {
          const tabNavigator = navigation.getParent();
          tabNavigator?.navigate('Home' as never);
        }, 1000);

        // Cleanup
        subscription.remove();
      } catch (error: any) {
        console.error('[OAuth2SuccessScreen] Error processing OAuth:', error);
        setErrorMessage(error?.message || 'Không thể xử lý đăng nhập Google');
        setStatus('error');
        setTimeout(() => {
          navigation.navigate('Login' as never);
        }, 3000);
      }
    };

    handleOAuthCallback();

    // Cleanup listener on unmount
    return () => {
      // Cleanup will be handled inside handleOAuthCallback
    };
  }, [navigation, loginWithGoogle]);

  return (
    <View style={styles.container}>
      {status === 'processing' && (
        <>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.text}>Đang xử lý đăng nhập Google...</Text>
        </>
      )}

      {status === 'success' && (
        <>
          <Text style={styles.successText}>✓</Text>
          <Text style={styles.text}>Đăng nhập thành công!</Text>
        </>
      )}

      {status === 'error' && (
        <>
          <Text style={styles.errorText}>✗</Text>
          <Text style={styles.text}>{errorMessage || 'Đăng nhập thất bại'}</Text>
          <Text style={styles.subText}>Đang chuyển về trang đăng nhập...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#444',
    textAlign: 'center',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  successText: {
    fontSize: 48,
    color: '#4CAF50',
  },
  errorText: {
    fontSize: 48,
    color: '#B3261E',
  },
});

