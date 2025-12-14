import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Snackbar } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
} from '../../../services/notificationService';
import {
  formatNotificationDate,
  getNotificationTypeLabel,
  Notification,
} from '../../../types/notification';

const ORANGE = '#FF6A00';

interface NotificationScreenProps {}

const NotificationsScreen: React.FC<NotificationScreenProps> = () => {
  const navigation = useNavigation();
  const { authState, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadNotifications = useCallback(
    async (pageNum: number = 0, append: boolean = false) => {
      if (!isAuthenticated || !authState) {
        setError('Bạn cần đăng nhập để xem thông báo.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (!append) {
          setIsLoading(true);
        }
        setError(null);

        const response = await getNotifications(authState, pageNum, 20);

        if (append) {
          setNotifications((prev) => [...prev, ...(response.content || [])]);
        } else {
          setNotifications(response.content || []);
        }

        setTotalPages(response.totalPages || 1);
        setPage(pageNum);
        setHasMore(!response.last && (response.content?.length || 0) > 0);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Không thể tải thông báo. Vui lòng thử lại.',
        );
        console.error('Failed to load notifications:', err);
        if (!append) {
          setNotifications([]);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, authState],
  );

  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !authState) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadCount(authState);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading unread notification count:', err);
    }
  }, [isAuthenticated, authState]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications(0);
      loadUnreadCount();

      // Polling unread count mỗi 30 giây
      pollingIntervalRef.current = setInterval(() => {
        loadUnreadCount();
      }, 30000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
        }
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, loadNotifications, loadUnreadCount]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setPage(0);
    loadNotifications(0, false);
    loadUnreadCount();
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore && page < totalPages - 1) {
      loadNotifications(page + 1, true);
    }
  };

  const navigateToActionUrl = (actionUrl: string) => {
    if (!actionUrl) return;

    // Map legacy customer order paths to current customer portal routes
    if (actionUrl === '/customer/orders' || actionUrl === '/customer/orders/') {
      navigation.navigate('Orders' as never);
      return;
    }

    if (actionUrl.startsWith('/customer/orders/')) {
      const orderId = actionUrl.substring('/customer/orders/'.length);
      if (orderId) {
        // Navigate to orders screen, order detail will be handled there
        navigation.navigate('Orders' as never);
      } else {
        navigation.navigate('Orders' as never);
      }
      return;
    }

    // For other paths, try to navigate directly
    // Note: In React Native, we might need to handle deep linking differently
    if (actionUrl.startsWith('/orders')) {
      navigation.navigate('Orders' as never);
    } else if (actionUrl.startsWith('/profile')) {
      navigation.navigate('ProfileMain' as never);
    } else {
      // For other URLs, just navigate to orders as fallback
      navigation.navigate('Orders' as never);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read nếu chưa đọc
    if (!notification.read) {
      try {
        // Optimistic update
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        await markNotificationAsRead(authState, notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
        // Revert optimistic update
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n)),
        );
        loadUnreadCount();
        setSnackbarMessage('Không thể đánh dấu đã đọc');
        setSnackbarVisible(true);
      }
    }

    // Navigate to action URL nếu có
    if (notification.actionUrl) {
      navigateToActionUrl(notification.actionUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!isAuthenticated || !authState) return;

    const unreadNotifications = notifications.filter((n) => !n.read);
    if (unreadNotifications.length === 0) {
      setSnackbarMessage('Tất cả thông báo đã được đọc');
      setSnackbarVisible(true);
      return;
    }

    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount((prev) => Math.max(0, prev - unreadNotifications.length));

      // Call API parallel
      await Promise.all(
        unreadNotifications.map((n) => markNotificationAsRead(authState, n.id)),
      );

      setSnackbarMessage('Đã đánh dấu tất cả là đã đọc');
      setSnackbarVisible(true);
      await loadUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
      setSnackbarMessage('Không thể đánh dấu tất cả là đã đọc');
      setSnackbarVisible(true);
      // Reload notifications để revert
      loadNotifications(page, false);
    }
  };

  const renderFooter = () => {
    if (!isLoading || notifications.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={ORANGE} />
      </View>
    );
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.read;

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.notificationItemUnread]}
        onPress={() => handleNotificationClick(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={3}>
            {item.message}
          </Text>
          <View style={styles.notificationFooter}>
            <Text style={styles.notificationType}>
              {getNotificationTypeLabel(item.type)}
            </Text>
            <Text style={styles.notificationDate}>
              {formatNotificationDate(item.createdAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-off-outline" size={64} color="#9E9E9E" />
          <Text style={styles.emptyText}>Vui lòng đăng nhập để xem thông báo của bạn.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Đánh dấu tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.loadingText}>Đang tải thông báo...</Text>
        </View>
      ) : error ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#9E9E9E" />
          <Text style={styles.emptyText}>{error}</Text>
          <Button
            mode="contained"
            onPress={() => loadNotifications(0)}
            buttonColor={ORANGE}
            style={{ marginTop: 16 }}
          >
            Thử lại
          </Button>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="bell-outline" size={64} color="#9E9E9E" />
          <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
          <Text style={styles.emptySubtext}>Các thông báo mới sẽ hiển thị ở đây</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[ORANGE]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Đóng',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: ORANGE,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  markAllButton: {
    padding: 4,
  },
  markAllText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#9E9E9E',
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  notificationItem: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginVertical: 6,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  notificationItemUnread: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: ORANGE,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    flex: 1,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationType: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '600',
  },
  notificationDate: {
    fontSize: 12,
    color: '#999',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
