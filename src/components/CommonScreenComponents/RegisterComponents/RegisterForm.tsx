import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type RegisterFormProps = {
  onSubmit?: (payload: { name: string; email: string; password: string; phone: string }) => void;
  hideTitle?: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onFieldChange?: () => void; // Callback to clear parent error message
};

export default function RegisterForm({
  onSubmit,
  hideTitle,
  isSubmitting = false,
  errorMessage,
  onFieldChange,
}: RegisterFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[0-9]{10,11}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Vui lòng nhập họ và tên';
    }

    if (!email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!validateEmail(email.trim())) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!validatePhone(phone.trim())) {
      newErrors.phone = 'Số điện thoại phải có 10-11 chữ số';
    }

    if (!password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    onSubmit?.({ name: name.trim(), email: email.trim(), password, phone: phone.trim() });
  };

  const isFormValid =
    name.trim() &&
    email.trim() &&
    password.trim() &&
    confirmPassword.trim() &&
    phone.trim() &&
    password === confirmPassword &&
    validateEmail(email.trim()) &&
    validatePhone(phone.trim());

  return (
    <View style={styles.container}>
      {!hideTitle && <Text style={styles.title}>Đăng ký</Text>}

      {errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Họ và tên *</Text>
        <TextInput
          style={[styles.input, errors.name && styles.inputError]}
          placeholder="Nhập họ và tên"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) {
              setErrors((prev) => ({ ...prev, name: undefined }));
            }
            onFieldChange?.();
          }}
          autoCapitalize="words"
          returnKeyType="next"
          editable={!isSubmitting}
        />
        {errors.name && <Text style={styles.fieldError}>{errors.name}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="you@example.com"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) {
              setErrors((prev) => ({ ...prev, email: undefined }));
            }
            onFieldChange?.();
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          editable={!isSubmitting}
        />
        {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Số điện thoại *</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          placeholder="0123456789"
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            if (errors.phone) {
              setErrors((prev) => ({ ...prev, phone: undefined }));
            }
            onFieldChange?.();
          }}
          keyboardType="phone-pad"
          returnKeyType="next"
          editable={!isSubmitting}
        />
        {errors.phone && <Text style={styles.fieldError}>{errors.phone}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Mật khẩu *</Text>
        <TextInput
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="••••••••"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) {
              setErrors((prev) => ({ ...prev, password: undefined }));
            }
            if (errors.confirmPassword && text === confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }
            onFieldChange?.();
          }}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="next"
          editable={!isSubmitting}
        />
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Xác nhận mật khẩu *</Text>
        <TextInput
          style={[styles.input, errors.confirmPassword && styles.inputError]}
          placeholder="••••••••"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (errors.confirmPassword) {
              setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }
            onFieldChange?.();
          }}
          secureTextEntry
          autoCapitalize="none"
          returnKeyType="done"
          editable={!isSubmitting}
          onSubmitEditing={handleSubmit}
        />
        {errors.confirmPassword && <Text style={styles.fieldError}>{errors.confirmPassword}</Text>}
      </View>

      <TouchableOpacity
        style={[styles.button, (!isFormValid || isSubmitting) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!isFormValid || isSubmitting}
      >
        <Text style={styles.buttonText}>{isSubmitting ? 'Đang xử lý...' : 'Tạo tài khoản'}</Text>
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
  inputError: {
    borderColor: '#B3261E',
    borderWidth: 1.5,
  },
  fieldError: {
    color: '#B3261E',
    fontSize: 12,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: '#FFECEC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFB4AB',
    marginBottom: 8,
  },
  errorText: {
    color: '#B3261E',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    height: 50,
    backgroundColor: '#FF6A00',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});


