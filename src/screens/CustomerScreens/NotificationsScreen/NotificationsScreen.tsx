import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../../constants/color';

const NotificationsScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thông báo</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="bell-outline" size={64} color={COLORS.gray} />
          <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
          <Text style={styles.emptySubtext}>Các thông báo mới sẽ hiển thị ở đây</Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    backgroundColor: '#FF6A00',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.gray,
  },
});

