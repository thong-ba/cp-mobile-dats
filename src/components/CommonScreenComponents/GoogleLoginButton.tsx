import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { startGoogleOAuth } from '../../services/googleAuthService';

type GoogleLoginButtonProps = {
  onSuccess?: (tokens: {
    token: string;
    refreshToken?: string;
    accountId: string;
    customerId?: string;
  }) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  variant?: 'login' | 'register';
};

export default function GoogleLoginButton({
  onSuccess,
  onError,
  disabled = false,
  variant = 'login',
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    try {
      const params = await startGoogleOAuth();

      if (params.error) {
        const errorMessage =
          params.error === 'User cancelled OAuth'
            ? 'Đã hủy đăng nhập với Google'
            : `Đăng nhập Google thất bại: ${params.error}`;
        onError?.(errorMessage);
        return;
      }

      const token = params.token || params.accessToken;
      if (!token || !params.accountId) {
        const missingParams = [];
        if (!token) missingParams.push('token');
        if (!params.accountId) missingParams.push('accountId');

        const errorMessage = `Không nhận được thông tin xác thực từ server. Thiếu: ${missingParams.join(', ')}`;
        onError?.(errorMessage);
        return;
      }

      // Success - pass tokens to parent
      onSuccess?.({
        token,
        refreshToken: params.refreshToken,
        accountId: params.accountId,
        customerId: params.customerId,
      });
    } catch (error: any) {
      console.error('[GoogleLoginButton] Error:', error);
      onError?.(error?.message || 'Đăng nhập Google thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonText = variant === 'login' ? 'Tiếp tục với Google' : 'Đăng ký với Google';

  return (
    <TouchableOpacity
      style={[styles.button, (isLoading || disabled) && styles.buttonDisabled]}
      onPress={handleGoogleLogin}
      disabled={isLoading || disabled}
      activeOpacity={0.8}
    >
      {isLoading ? (
        <ActivityIndicator color="#DB4437" size="small" />
      ) : (
        <>
          <MaterialCommunityIcons name="google" size={22} color="#DB4437" />
          <Text style={[styles.buttonText, { color: '#DB4437' }]}>{buttonText}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
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
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

