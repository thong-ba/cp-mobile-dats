import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Avatar, Button, Modal, Portal, Snackbar } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import { useChat } from '../../../context/ChatContext';
import { uploadImage, uploadVideo } from '../../../services/uploadService';
import { MediaItem } from '../../../types/chat';
import { containsSensitiveInfo } from '../../../utils/messageFilter';

const { width } = Dimensions.get('window');
const ORANGE = '#FF6A00';

const ChatScreen: React.FC = () => {
  const { authState } = useAuth();
  const {
    isOpen,
    storeId,
    storeName,
    messages,
    isLoading,
    isSending,
    inputMessage,
    setInputMessage,
    sendMessage,
    closeChat,
    loadMessages,
  } = useChat();

  const [selectedFiles, setSelectedFiles] = useState<Array<{ uri: string; type: string; name: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Request permissions for image/video picker
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: imageStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (imageStatus !== 'granted' || cameraStatus !== 'granted') {
          setSnackbarMessage('Cần quyền truy cập thư viện ảnh và camera');
          setSnackbarVisible(true);
        }
      }
    })();
  }, []);

  // Pick image
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newFiles = result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.type || 'image',
          name: asset.fileName || `image_${Date.now()}.jpg`,
        }));
        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('[ChatScreen] Failed to pick image:', error);
      setSnackbarMessage('Không thể chọn ảnh');
      setSnackbarVisible(true);
    }
  }, []);

  // Pick video
  const pickVideo = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedFiles((prev) => [
          ...prev,
          {
            uri: asset.uri,
            type: 'video',
            name: asset.fileName || `video_${Date.now()}.mp4`,
          },
        ]);
      }
    } catch (error) {
      console.error('[ChatScreen] Failed to pick video:', error);
      setSnackbarMessage('Không thể chọn video');
      setSnackbarVisible(true);
    }
  }, []);

  // Remove selected file
  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!inputMessage.trim() && selectedFiles.length === 0) {
      return;
    }

    // Check sensitive info
    if (inputMessage.trim() && containsSensitiveInfo(inputMessage)) {
      setBlockedModalVisible(true);
      return;
    }

    try {
      setIsUploading(true);

      // Upload files if any
      let mediaUrls: MediaItem[] = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          try {
            if (file.type === 'video') {
              const result = await uploadVideo({
                accessToken: authState.accessToken!,
                file: {
                  uri: file.uri,
                  type: 'video/mp4',
                  name: file.name,
                },
              });
              mediaUrls.push({ url: result.url, type: 'video' });
            } else {
              const result = await uploadImage({
                accessToken: authState.accessToken!,
                file: {
                  uri: file.uri,
                  type: 'image/jpeg',
                  name: file.name,
                },
              });
              mediaUrls.push({ url: result.url, type: 'image' });
            }
          } catch (error: any) {
            console.error('[ChatScreen] Failed to upload file:', error);
            setSnackbarMessage(error.message || 'Không thể upload file');
            setSnackbarVisible(true);
            setIsUploading(false);
            return;
          }
        }
      }

      // Send message
      await sendMessage(inputMessage.trim(), mediaUrls.length > 0 ? mediaUrls : undefined);

      // Clear input and files
      setInputMessage('');
      setSelectedFiles([]);
    } catch (error: any) {
      console.error('[ChatScreen] Failed to send message:', error);
      setSnackbarMessage(error.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
      setSnackbarVisible(true);
    } finally {
      setIsUploading(false);
    }
  }, [inputMessage, selectedFiles, authState, sendMessage, setInputMessage]);

  // Render message bubble
  const renderMessage = useCallback((message: any, index: number) => {
    const isUser = message.role === 'user';
    const hasMedia = message.mediaUrl && (
      typeof message.mediaUrl === 'string' || (Array.isArray(message.mediaUrl) && message.mediaUrl.length > 0)
    );

    return (
      <View
        key={message.id || index}
        style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.assistantMessageContainer]}
      >
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {hasMedia && (
            <View style={styles.mediaContainer}>
              {typeof message.mediaUrl === 'string' ? (
                message.messageType === 'VIDEO' ? (
                  <View style={styles.videoPlaceholder}>
                    <MaterialCommunityIcons name="play-circle" size={48} color={ORANGE} />
                    <Text style={styles.videoText}>Video</Text>
                  </View>
                ) : (
                  <Image source={{ uri: message.mediaUrl }} style={styles.messageImage} resizeMode="cover" />
                )
              ) : (
                Array.isArray(message.mediaUrl) &&
                message.mediaUrl.map((media: MediaItem, idx: number) => (
                  <View key={idx} style={styles.mediaItem}>
                    {media.type === 'video' ? (
                      <View style={styles.videoPlaceholder}>
                        <MaterialCommunityIcons name="play-circle" size={48} color={ORANGE} />
                        <Text style={styles.videoText}>Video</Text>
                      </View>
                    ) : (
                      <Image source={{ uri: media.url }} style={styles.messageImage} resizeMode="cover" />
                    )}
                  </View>
                ))
              )}
            </View>
          )}
          {message.content && message.content.trim() && (
            <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.assistantMessageText]}>
              {message.content}
            </Text>
          )}
          <Text style={[styles.messageTime, isUser ? styles.userMessageTime : styles.assistantMessageTime]}>
            {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <Portal>
      <Modal
        visible={isOpen}
        onDismiss={closeChat}
        contentContainerStyle={styles.modalContainer}
        dismissable={true}
        dismissableBackButton={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={closeChat} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#272727" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Avatar.Text
                size={40}
                label={storeName ? storeName.substring(0, 2).toUpperCase() : 'ST'}
                style={styles.storeAvatar}
                labelStyle={styles.storeAvatarLabel}
              />
              <Text style={styles.storeName}>{storeName || 'Cửa hàng'}</Text>
            </View>
            <View style={styles.headerRight} />
          </View>

          {/* Messages Area */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesArea}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={ORANGE} />
                <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="message-text-outline" size={64} color="#CCCCCC" />
                <Text style={styles.emptyText}>Chưa có tin nhắn nào</Text>
                <Text style={styles.emptySubtext}>Bắt đầu cuộc trò chuyện với cửa hàng</Text>
              </View>
            ) : (
              messages.map((message, index) => renderMessage(message, index))
            )}
          </ScrollView>

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <ScrollView horizontal style={styles.filesPreview} showsHorizontalScrollIndicator={false}>
              {selectedFiles.map((file, index) => (
                <View key={index} style={styles.filePreviewItem}>
                  {file.type === 'video' ? (
                    <View style={styles.filePreviewVideo}>
                      <MaterialCommunityIcons name="video" size={32} color="#FFFFFF" />
                    </View>
                  ) : (
                    <Image source={{ uri: file.uri }} style={styles.filePreviewImage} resizeMode="cover" />
                  )}
                  <TouchableOpacity
                    style={styles.removeFileButton}
                    onPress={() => removeFile(index)}
                  >
                    <MaterialCommunityIcons name="close-circle" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Input Area */}
          <View style={styles.inputArea}>
            <TouchableOpacity onPress={pickImage} style={styles.attachButton}>
              <MaterialCommunityIcons name="image-outline" size={24} color={ORANGE} />
            </TouchableOpacity>
            <TouchableOpacity onPress={pickVideo} style={styles.attachButton}>
              <MaterialCommunityIcons name="video-outline" size={24} color={ORANGE} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Nhập tin nhắn..."
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={isSending || isUploading || (!inputMessage.trim() && selectedFiles.length === 0)}
              style={[
                styles.sendButton,
                (isSending || isUploading || (!inputMessage.trim() && selectedFiles.length === 0)) &&
                  styles.sendButtonDisabled,
              ]}
            >
              {isSending || isUploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Blocked Message Modal */}
      <Portal>
        <Modal
          visible={blockedModalVisible}
          onDismiss={() => setBlockedModalVisible(false)}
          contentContainerStyle={styles.blockedModalContent}
        >
          <MaterialCommunityIcons name="alert-circle" size={64} color="#FF6A00" />
          <Text style={styles.blockedModalTitle}>Tin nhắn đã bị chặn</Text>
          <Text style={styles.blockedModalText}>
            Tin nhắn của bạn chứa thông tin nhạy cảm (số điện thoại, email, hoặc URL). Vui lòng không chia sẻ thông tin
            liên hệ trong chat.
          </Text>
          <Button mode="contained" onPress={() => setBlockedModalVisible(false)} style={styles.blockedModalButton}>
            Đã hiểu
          </Button>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </Portal>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    margin: 0,
    padding: 0,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  storeAvatar: {
    backgroundColor: ORANGE,
  },
  storeAvatarLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  storeName: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#272727',
  },
  headerRight: {
    width: 32,
  },
  messagesArea: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: width * 0.75,
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: ORANGE,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#272727',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  assistantMessageTime: {
    color: '#999',
  },
  mediaContainer: {
    marginBottom: 8,
  },
  mediaItem: {
    marginBottom: 8,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  videoPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#000000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoText: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 12,
  },
  filesPreview: {
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F7F7F7',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  filePreviewItem: {
    marginRight: 8,
    position: 'relative',
  },
  filePreviewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  filePreviewVideo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFileButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F7F7F7',
    borderRadius: 20,
    fontSize: 15,
    color: '#272727',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  blockedModalContent: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    margin: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  blockedModalTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#272727',
  },
  blockedModalText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  blockedModalButton: {
    marginTop: 24,
    backgroundColor: ORANGE,
  },
});

