import httpClient from '../api/httpClient';
import { AuthState } from '../context/AuthContext';
import {
    ChatMessage,
    Conversation,
    SendMessageRequest
} from '../types/chat';

/**
 * Chat Service for Customer
 * Handles API calls for customer chat functionality
 */

/**
 * Get current customer ID from auth state or localStorage
 */
export const getCurrentCustomerId = async (authState: AuthState): Promise<string | null> => {
  // Priority 1: Try to get from decoded token customerId (most reliable)
  if (authState.decodedToken?.customerId) {
    return authState.decodedToken.customerId;
  }

  // Priority 2: Try to get from customerProfile
  if (authState.customerProfile?.id) {
    return authState.customerProfile.id;
  }

  // Priority 3: Try to get from AsyncStorage
  try {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    const customerId = await AsyncStorage.getItem('customerId');
    if (customerId) {
      return customerId;
    }
  } catch (error) {
    console.error('[ChatService] Failed to get customer ID from storage:', error);
  }

  // Last resort: Try decodedToken.sub (but this might be email, not ID)
  if (authState.decodedToken?.sub) {
    // Check if sub looks like a UUID (customer ID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(authState.decodedToken.sub)) {
      return authState.decodedToken.sub;
    }
    // If sub is email, don't use it - return null
    console.warn('[ChatService] decodedToken.sub is not a valid customer ID:', authState.decodedToken.sub);
  }

  console.error('[ChatService] Could not find customer ID');
  return null;
};

/**
 * GET /api/chat/conversations/{customerId}/{storeId}/messages
 * Get messages between customer and store
 */
export const getMessages = async (
  customerId: string,
  storeId: string,
  authState: AuthState,
  limit?: number,
): Promise<ChatMessage[]> => {
  const params: Record<string, any> = {
    viewerType: 'CUSTOMER',
  };

  if (limit) {
    params.limit = limit;
  }

  try {
    const { data } = await httpClient.get<ChatMessage[] | { data: ChatMessage[] }>(
      `/chat/conversations/${customerId}/${storeId}/messages`,
      {
        params,
        headers: {
          Authorization: `Bearer ${authState.accessToken}`,
        },
      },
    );

    // Handle both array and wrapped response
    const messages = Array.isArray(data) ? data : data.data || [];
    return messages;
  } catch (error: any) {
    console.error('[ChatService] Failed to get messages:', error);
    if (error?.response?.status === 404) {
      return []; // No messages yet
    }
    throw error;
  }
};

/**
 * POST /api/chat/conversations/{customerId}/{storeId}/messages
 * Send a message
 */
export const sendMessage = async (
  customerId: string,
  storeId: string,
  message: SendMessageRequest,
  authState: AuthState,
): Promise<ChatMessage> => {
  try {
    const { data } = await httpClient.post<ChatMessage | { data: ChatMessage }>(
      `/chat/conversations/${customerId}/${storeId}/messages`,
      message,
      {
        headers: {
          Authorization: `Bearer ${authState.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    // Handle both direct and wrapped response
    return Array.isArray(data) ? data[0] : (data as any).data || data;
  } catch (error: any) {
    console.error('[ChatService] Failed to send message:', error);
    throw error;
  }
};

/**
 * GET /api/chat/customers/{customerId}/conversations
 * Get all conversations for a customer
 */
export const getCustomerConversations = async (
  customerId: string,
  authState: AuthState,
): Promise<Conversation[]> => {
  try {
    const { data } = await httpClient.get<Conversation[] | { data: Conversation[] }>(
      `/chat/customers/${customerId}/conversations`,
      {
        headers: {
          Authorization: `Bearer ${authState.accessToken}`,
        },
      },
    );

    // Handle both array and wrapped response
    return Array.isArray(data) ? data : data.data || [];
  } catch (error: any) {
    console.error('[ChatService] Failed to get conversations:', error);
    throw error;
  }
};

/**
 * POST /api/chat/conversations/{customerId}/{storeId}/read?viewerId={viewerId}
 * Mark messages as read
 */
export const markAsRead = async (
  customerId: string,
  storeId: string,
  viewerId: string,
  authState: AuthState,
): Promise<void> => {
  try {
    await httpClient.post(
      `/chat/conversations/${customerId}/${storeId}/read`,
      {},
      {
        params: {
          viewerId,
        },
        headers: {
          Authorization: `Bearer ${authState.accessToken}`,
        },
      },
    );
  } catch (error: any) {
    console.error('[ChatService] Failed to mark as read:', error);
    // Don't throw - this is not critical
  }
};

