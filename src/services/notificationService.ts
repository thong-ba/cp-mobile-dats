import httpClient from '../api/httpClient';
import { AuthState } from '../context/AuthContext';
import { NotificationPageResponse } from '../types/notification';

type AuthenticatedCustomerRequest = {
  authState: AuthState | null;
};

/**
 * GET /api/customer/notifications
 * Lấy danh sách thông báo với pagination
 */
export const getNotifications = async (
  authState: AuthState | null,
  page: number = 0,
  size: number = 20,
): Promise<NotificationPageResponse> => {
  if (!authState?.accessToken) {
    throw new Error('Access token not found. User must be authenticated.');
  }

  const queryParams = new URLSearchParams();
  queryParams.append('page', String(page));
  queryParams.append('size', String(size));

  const endpoint = `/customer/notifications?${queryParams.toString()}`;

  const { data } = await httpClient.get<NotificationPageResponse>(endpoint, {
    headers: {
      Authorization: `Bearer ${authState.accessToken}`,
      Accept: 'application/json',
    },
  });

  return data;
};

/**
 * POST /api/customer/notifications/{id}/read
 * Đánh dấu thông báo đã đọc
 */
export const markNotificationAsRead = async (
  authState: AuthState | null,
  notificationId: string,
): Promise<void> => {
  if (!authState?.accessToken) {
    throw new Error('Access token not found. User must be authenticated.');
  }

  const endpoint = `/customer/notifications/${notificationId}/read`;

  await httpClient.post(
    endpoint,
    {},
    {
      headers: {
        Authorization: `Bearer ${authState.accessToken}`,
        Accept: '*/*',
        'Content-Type': 'application/json',
      },
    },
  );
};

/**
 * GET /api/customer/notifications/unread-count
 * Lấy số lượng thông báo chưa đọc
 */
export const getUnreadCount = async (authState: AuthState | null): Promise<number> => {
  if (!authState?.accessToken) {
    return 0;
  }

  try {
    const endpoint = `/customer/notifications/unread-count`;

    const { data } = await httpClient.get<number | { count: number } | { unreadCount: number }>(
      endpoint,
      {
        headers: {
          Authorization: `Bearer ${authState.accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    // Handle multiple response formats
    if (typeof data === 'number') {
      return data;
    }

    if (typeof (data as any)?.count === 'number') {
      return (data as any).count;
    }

    if (typeof (data as any)?.unreadCount === 'number') {
      return (data as any).unreadCount;
    }

    return Number(data) || 0;
  } catch (error: any) {
    // Return 0 on error to prevent UI issues
    console.error('Error loading unread notification count:', error);
    return 0;
  }
};

