import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type LoginFormProps = {
  onSubmit?: (payload: { email: string; password: string }) => void;
  hideTitle?: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  initialEmail?: string; // Pre-fill email from register
  onForgotPassword?: () => void; // Callback khi click "Quên mật khẩu"
  onResendVerifyEmail?: () => void; // Callback khi click "Gửi lại mail xác nhận"
  resendCooldown?: number; // Thời gian đếm ngược (giây) cho resend verify email
  onEmailChange?: (email: string) => void; // Callback khi email thay đổi
};

export default function LoginForm({ 
  onSubmit, 
  hideTitle, 
  isSubmitting, 
  errorMessage,
  initialEmail = '',
  onForgotPassword,
  onResendVerifyEmail,
  resendCooldown = 0,
  onEmailChange,
}: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Update email when initialEmail changes (from route params)
  React.useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  // Notify parent when email changes
  React.useEffect(() => {
    onEmailChange?.(email);
  }, [email, onEmailChange]);

  const handleSubmit = () => {
    if (isSubmitting) {
      return;
    }
    onSubmit?.({ email, password });
  };

  return (
    <View style={styles.container}>
      {!hideTitle && <Text style={styles.title}>Đăng nhập</Text>}
      {!!errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}

      <View style={styles.field}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          editable={!isSubmitting}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Mật khẩu</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            // Không hiển thị placeholder dấu chấm khi trống
            placeholder=""
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="done"
            editable={!isSubmitting}
            onSubmitEditing={handleSubmit}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            activeOpacity={0.7}
            onPress={() => setShowPassword((prev) => !prev)}
            disabled={isSubmitting}
          >
            <MaterialCommunityIcons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#777"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Forgot Password & Resend Verify Email Row */}
      <View style={styles.optionsRow}>
        {onForgotPassword && (
          <TouchableOpacity
            onPress={onForgotPassword}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
          </TouchableOpacity>
        )}
        {onResendVerifyEmail && (
          <TouchableOpacity
            onPress={onResendVerifyEmail}
            disabled={isSubmitting || resendCooldown > 0}
            activeOpacity={resendCooldown > 0 ? 1 : 0.7}
            style={styles.resendButton}
          >
            <Text
              style={[
                styles.resendButtonText,
                (isSubmitting || resendCooldown > 0) && styles.resendButtonTextDisabled,
              ]}
            >
              {resendCooldown > 0
                ? `Gửi lại mail xác nhận (${resendCooldown}s)`
                : 'Gửi lại mail xác nhận'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        activeOpacity={isSubmitting ? 1 : 0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Đăng nhập</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#444',
    fontWeight: '600',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  errorMessage: {
    color: '#B3261E',
    backgroundColor: '#FFECEC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFB4AB',
  },
  button: {
    marginTop: 8,
    height: 50,
    backgroundColor: '#FF6A00',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingLeft: 14,
    paddingRight: 8,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
    height: '100%',
  },
  eyeIcon: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#FF6A00',
    fontWeight: '600',
  },
  resendButton: {
    alignSelf: 'flex-end',
  },
  resendButtonText: {
    fontSize: 12,
    color: '#FF6A00',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: '#9CA3AF',
    textDecorationLine: 'none',
  },
});


