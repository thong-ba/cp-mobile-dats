export type MessageSenderType = 'CUSTOMER' | 'STORE';
export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'MIXED';

export interface MediaItem {
  url: string;
  type?: string; // 'image' | 'video'
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderType: MessageSenderType;
  content: string;
  messageType: MessageType;
  mediaUrl?: string | MediaItem[];
  timestamp?: string;
  createdAt?: string;
  read?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant'; // user = CUSTOMER, assistant = STORE
  content: string;
  messageType?: MessageType;
  mediaUrl?: string | MediaItem[];
  timestamp: Date;
  read?: boolean;
}

export interface Conversation {
  id: string;
  customerId: string;
  customerName?: string;
  storeId: string;
  storeName?: string;
  lastMessage: string;
  lastMessageTime: string | Date;
  customerUnreadCount?: number;
  storeUnreadCount?: number;
  unreadCount?: number;
  lastMessageSenderType?: MessageSenderType;
}

export interface SendMessageRequest {
  senderId: string;
  senderType: MessageSenderType;
  content: string;
  messageType: MessageType;
  mediaUrl?: string | MediaItem[];
}

export interface FirebaseChatMessage {
  id: string;
  senderId: string;
  senderType: MessageSenderType;
  content: string;
  messageType: MessageType;
  mediaUrl?: string | MediaItem[];
  createdAt: string | number;
  timestamp?: number;
  read?: boolean;
}

