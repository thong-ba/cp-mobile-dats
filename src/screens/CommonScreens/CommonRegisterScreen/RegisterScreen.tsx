import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RegisterForm } from '../../../components/CommonScreenComponents/RegisterComponents';

export default function RegisterScreen() {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerArea}>
          <Text style={styles.screenTitle}>Đăng ký</Text>
          <Text style={styles.screenSubtitle}>Tạo tài khoản mới chỉ với vài bước đơn giản</Text>
        </View>

        <View style={styles.card}>
          <RegisterForm hideTitle onSubmit={(payload) => {
            // TODO: integrate with AuthService later
            console.log('Register submit', payload);
          }} />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>Hoặc tiếp tục với</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity style={[styles.socialButton, styles.googleButton]} onPress={() => {}}>
            <MaterialCommunityIcons name="google" size={22} color="#DB4437" />
            <Text style={[styles.socialText, { color: '#DB4437' }]}>Đăng ký với Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.socialButton, styles.githubButton]} onPress={() => {}}>
            <MaterialCommunityIcons name="github" size={22} color="#000000" />
            <Text style={[styles.socialText, { color: '#000000' }]}>Đăng ký với GitHub</Text>
          </TouchableOpacity>
          <View style={{ marginTop: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <Text style={{ color: '#444' }}>Đã có tài khoản?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login' as never)}>
              <Text style={{ color: '#FF6A00', fontWeight: '700' }}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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


