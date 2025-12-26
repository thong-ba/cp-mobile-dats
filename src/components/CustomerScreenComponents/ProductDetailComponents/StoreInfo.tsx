import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import { useChat } from '../../../context/ChatContext';
import { getStoreById, StoreDetailResponse } from '../../../services/storeService';

const ORANGE = '#FF6A00';

interface StoreInfoProps {
  storeId: string;
  storeName: string;
  storeAvatar?: string;
}

const StoreInfo: React.FC<StoreInfoProps> = ({ storeId, storeName, storeAvatar }) => {
  const navigation = useNavigation();
  const { isAuthenticated } = useAuth();
  const { openChat } = useChat();
  const [storeData, setStoreData] = useState<StoreDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadStoreData = async () => {
      try {
        setIsLoading(true);
        const data = await getStoreById(storeId);
        setStoreData(data);
      } catch (error) {
        console.error('[StoreInfo] Failed to load store data:', error);
        // Không block UI nếu load store data thất bại
      } finally {
        setIsLoading(false);
      }
    };

    loadStoreData();
  }, [storeId]);

  const handleAvatarClick = () => {
    // @ts-ignore
    navigation.navigate('Store', { storeId });
  };

  const handleStoreNameClick = () => {
    // @ts-ignore
    navigation.navigate('Store', { storeId });
  };

  const handleVisitStore = () => {
    // @ts-ignore
    navigation.navigate('Store', { storeId });
  };

  const handleChatWithStore = () => {
    if (!isAuthenticated) {
      // Navigate to login if not authenticated
      // @ts-ignore
      navigation.navigate('Auth', { screen: 'Login' });
      return;
    }
    // Open chat with store
    openChat('store', storeId, storeData?.storeName || storeName);
  };

  // Get avatar URL: priority: storeData.logoUrl > storeAvatar > default
  const avatarUrl =
    storeData?.logoUrl ||
    storeAvatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(storeName)}&background=ff6b35&color=fff&size=128`;

  return (
    <View style={styles.container}>
      <View style={styles.storeInfoRow}>
        <TouchableOpacity onPress={handleAvatarClick} activeOpacity={0.7}>
          {isLoading ? (
            <View style={styles.avatarContainer}>
              <ActivityIndicator size="small" color={ORANGE} />
            </View>
          ) : (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              onError={() => {
                // Fallback to default avatar on error
              }}
            />
          )}
        </TouchableOpacity>
        <View style={styles.storeInfo}>
          <TouchableOpacity onPress={handleStoreNameClick} activeOpacity={0.7}>
            <Text variant="titleMedium" style={styles.storeName}>
              {storeName}
            </Text>
          </TouchableOpacity>
          {storeData?.rating && (
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={16} color="#FFB800" />
              <Text variant="bodySmall" style={[styles.rating, { marginLeft: 4 }]}>
                {storeData.rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.actionsRow}>
        <Button
          mode="outlined"
          icon="message-text-outline"
          onPress={handleChatWithStore}
          style={[styles.chatButton, { marginRight: 8 }]}
          labelStyle={styles.chatButtonLabel}
        >
          Chat
        </Button>
        <Button
          mode="contained"
          icon="store"
          onPress={handleVisitStore}
          style={styles.visitButton}
          labelStyle={styles.visitButtonLabel}
        >
          Xem gian hàng
        </Button>
      </View>
    </View>
  );
};

export default StoreInfo;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFEADB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ORANGE,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: ORANGE,
  },
  storeInfo: {
    flex: 1,
    marginLeft: 12,
  },
  storeName: {
    fontWeight: '600',
    color: '#272727',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    color: '#666',
  },
  actionsRow: {
    flexDirection: 'row',
  },
  chatButton: {
    flex: 1,
    borderColor: ORANGE,
  },
  chatButtonLabel: {
    color: ORANGE,
  },
  visitButton: {
    flex: 1,
    backgroundColor: ORANGE,
  },
  visitButtonLabel: {
    color: '#FFFFFF',
  },
});

