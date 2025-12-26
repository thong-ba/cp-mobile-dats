import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentCustomerId, getMessages, markAsRead, sendMessage as sendMessageAPI } from '../services/chatService';
import { subscribeToMessages as subscribeToFirestoreMessages } from '../services/firestoreChatService';
import { Message, MessageType, SendMessageRequest } from '../types/chat';
import { filterMessages } from '../utils/messageFilter';
import { useAuth } from './AuthContext';

interface ChatContextValue {
  // Chat state
  isOpen: boolean;
  chatMode: 'ai' | 'store' | null;
  storeId: string | null;
  storeName: string | null;
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  inputMessage: string;
  
  // Actions
  openChat: (mode: 'store', storeId: string, storeName?: string) => void;
  closeChat: () => void;
  setInputMessage: (message: string) => void;
  sendMessage: (content: string, mediaUrls?: Array<{ url: string; type?: string }>) => Promise<void>;
  loadMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { authState, isAuthenticated } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState<'ai' | 'store' | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState('');

  // Firestore unsubscribe function
  const firestoreUnsubscribeRef = React.useRef<(() => void) | null>(null);

  // Get customer ID
  const getCustomerId = useCallback(async (): Promise<string | null> => {
    if (!isAuthenticated) {
      return null;
    }
    return await getCurrentCustomerId(authState);
  }, [isAuthenticated, authState]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!isOpen || !storeId || !isAuthenticated) {
      return;
    }

    try {
      setIsLoading(true);
      const customerId = await getCustomerId();
      if (!customerId) {
        console.error('[ChatContext] No customer ID');
        return;
      }

      const chatMessages = await getMessages(customerId, storeId, authState, 100);
      
      // Convert ChatMessage[] to Message[]
      const convertedMessages: Message[] = chatMessages.map((msg) => ({
        id: msg.id || `${msg.senderId}_${msg.createdAt}`,
        role: msg.senderType === 'CUSTOMER' ? 'user' : 'assistant',
        content: msg.content,
        messageType: msg.messageType,
        mediaUrl: msg.mediaUrl,
        timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
        read: msg.read,
      }));

      // Filter messages
      const filtered = filterMessages(convertedMessages);
      setMessages(filtered);

      // Mark as read
      await markAsRead(customerId, storeId, customerId, authState);
    } catch (error) {
      console.error('[ChatContext] Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, storeId, isAuthenticated, authState, getCustomerId]);

  // Open chat
  const openChat = useCallback(async (mode: 'store', storeIdParam: string, storeNameParam?: string) => {
    if (!isAuthenticated) {
      console.warn('[ChatContext] User not authenticated');
      return;
    }

    setStoreId(storeIdParam);
    setStoreName(storeNameParam || null);
    setChatMode(mode);
    setIsOpen(true);
    setMessages([]);
  }, [isAuthenticated]);

  // Close chat
  const closeChat = useCallback(() => {
    // Unsubscribe from Firestore
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
      firestoreUnsubscribeRef.current = null;
    }

    setIsOpen(false);
    setChatMode(null);
    setStoreId(null);
    setStoreName(null);
    setMessages([]);
    setInputMessage('');
  }, []);

  // Send message
  const sendMessage = useCallback(
    async (content: string, mediaUrls?: Array<{ url: string; type?: string }>) => {
      if (!isOpen || !storeId || !isAuthenticated) {
        return;
      }

      try {
        setIsSending(true);
        const customerId = await getCustomerId();
        if (!customerId) {
          console.error('[ChatContext] No customer ID');
          return;
        }

        // Determine message type
        let messageType: MessageType = 'TEXT';
        if (mediaUrls && mediaUrls.length > 0) {
          if (mediaUrls.length === 1) {
            const media = mediaUrls[0];
            if (media.type === 'video' || media.url.includes('.mp4') || media.url.includes('.webm')) {
              messageType = 'VIDEO';
            } else {
              messageType = 'IMAGE';
            }
          } else {
            messageType = 'MIXED';
          }
        }

        // Build message request
        const messageRequest: SendMessageRequest = {
          senderId: customerId,
          senderType: 'CUSTOMER',
          content: content.trim(),
          messageType,
          mediaUrl: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
        };

        // Send to API
        const sentMessage = await sendMessageAPI(customerId, storeId, messageRequest, authState);

        // Convert to Message format and add to state
        const newMessage: Message = {
          id: sentMessage.id || `${sentMessage.senderId}_${sentMessage.createdAt}`,
          role: 'user',
          content: sentMessage.content,
          messageType: sentMessage.messageType,
          mediaUrl: sentMessage.mediaUrl,
          timestamp: sentMessage.createdAt ? new Date(sentMessage.createdAt) : new Date(),
          read: sentMessage.read,
        };

        setMessages((prev) => [...prev, newMessage]);
        setInputMessage('');

        // TODO: Send to Firestore if configured
        // await sendMessageToFirestore(customerId, storeId, messageRequest);
      } catch (error) {
        console.error('[ChatContext] Failed to send message:', error);
        throw error;
      } finally {
        setIsSending(false);
      }
    },
    [isOpen, storeId, isAuthenticated, authState, getCustomerId],
  );

  // Load messages when chat opens
  useEffect(() => {
    if (isOpen && storeId) {
      loadMessages();
    }
  }, [isOpen, storeId, loadMessages]);

  // Subscribe to Firestore when messages are loaded
  useEffect(() => {
    if (!isOpen || !storeId || messages.length === 0) {
      return;
    }

    // Unsubscribe previous listener
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current();
    }

    // Subscribe to Firestore (if configured)
    const setupFirestoreSubscription = async () => {
      const customerId = await getCustomerId();
      if (!customerId) {
        return;
      }

      const unsubscribe = subscribeToFirestoreMessages(
        customerId,
        storeId,
        (firestoreMessages) => {
          // Convert Firestore messages to Message format
          const newMessages: Message[] = firestoreMessages.map((msg) => ({
            id: msg.id,
            role: msg.senderType === 'CUSTOMER' ? 'user' : 'assistant',
            content: msg.content,
            messageType: msg.messageType,
            mediaUrl: msg.mediaUrl,
            timestamp: msg.createdAt
              ? typeof msg.createdAt === 'string'
                ? new Date(msg.createdAt)
                : new Date(msg.createdAt)
              : new Date(),
            read: msg.read,
          }));

          // Filter and merge with existing messages
          const filtered = filterMessages(newMessages);
          setMessages((prev) => {
            // Merge and deduplicate by ID
            const merged = [...prev];
            filtered.forEach((newMsg) => {
              const existingIndex = merged.findIndex((m) => m.id === newMsg.id);
              if (existingIndex >= 0) {
                merged[existingIndex] = newMsg;
              } else {
                merged.push(newMsg);
              }
            });
            // Sort by timestamp
            return merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          });
        },
      );

      firestoreUnsubscribeRef.current = unsubscribe;
    };

    setupFirestoreSubscription();

    // Cleanup
    return () => {
      if (firestoreUnsubscribeRef.current) {
        firestoreUnsubscribeRef.current();
        firestoreUnsubscribeRef.current = null;
      }
    };
  }, [isOpen, storeId, getCustomerId]);

  const value = useMemo<ChatContextValue>(
    () => ({
      isOpen,
      chatMode,
      storeId,
      storeName,
      messages,
      isLoading,
      isSending,
      inputMessage,
      openChat,
      closeChat,
      setInputMessage,
      sendMessage,
      loadMessages,
    }),
    [
      isOpen,
      chatMode,
      storeId,
      storeName,
      messages,
      isLoading,
      isSending,
      inputMessage,
      openChat,
      closeChat,
      sendMessage,
      loadMessages,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

