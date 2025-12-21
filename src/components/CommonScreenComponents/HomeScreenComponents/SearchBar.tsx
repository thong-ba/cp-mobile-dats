import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../../constants/color';
import { useAuth } from '../../../context/AuthContext';
import { getCustomerCart } from '../../../services/cartService';

type Props = {
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  isLoading?: boolean;
};

const SearchBar: React.FC<Props> = ({
  value,
  onChangeText,
  onSubmitEditing,
  isLoading = false,
}) => {
  const navigation = useNavigation();
  const { authState, isAuthenticated } = useAuth();
  const [cartItemCount, setCartItemCount] = useState(0);
  const [isLoadingCart, setIsLoadingCart] = useState(false);
  
  const suggestions = useMemo(
    () => ['JBL Party 200', 'Sony Sonic', 'LG King', 'Sony WH-1000XM5', 
        'JBL Flip 6', 'Shure MV7', 'Sony SRS-XB', 'Sony SRS-XB1000', 
        'Sony SRS-XB12', 'Sony SRS-XB13', 'Sony SRS-XB14', 'Sony SRS-XB15'],
    [],
  );
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % suggestions.length);
    }, 3000);
    return () => clearInterval(id);
  }, [suggestions.length]);

  const loadCartCount = useCallback(async () => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;

    if (!customerId || !accessToken || !isAuthenticated) {
      setCartItemCount(0);
      return;
    }

    try {
      setIsLoadingCart(true);
      const cart = await getCustomerCart({ customerId, accessToken });
      const count = cart?.items?.length ?? 0;
      setCartItemCount(count);
    } catch (error) {
      console.error('[SearchBar] Failed to load cart count:', error);
      setCartItemCount(0);
    } finally {
      setIsLoadingCart(false);
    }
  }, [authState.decodedToken?.customerId, authState.accessToken, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCartCount();
      // Poll cart count every 30 seconds
      const intervalId = setInterval(() => {
        loadCartCount();
      }, 30000);
      return () => clearInterval(intervalId);
    } else {
      setCartItemCount(0);
    }
  }, [isAuthenticated, loadCartCount]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.inputRow}>
          <MaterialCommunityIcons name="magnify" size={22} color={COLORS.gray} />
          <TextInput
            placeholder={`${suggestions[placeholderIndex]}...`}
            placeholderTextColor={COLORS.gray}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={() => onSubmitEditing?.()}
            returnKeyType="search"
          />
          {/* <TouchableOpacity activeOpacity={0.7}>
            <MaterialCommunityIcons name="camera-outline" size={22} color={COLORS.gray} />
          </TouchableOpacity> */}
        </View>
        <TouchableOpacity
          style={styles.actionIcon}
          activeOpacity={0.8}
          onPress={() => {
            // @ts-ignore - navigate to Cart
            navigation.navigate('Cart');
          }}
        >
          {isLoading || isLoadingCart ? (
            <ActivityIndicator size="small" color="#FF6A00" />
          ) : (
            <View style={styles.cartIconContainer}>
              <MaterialCommunityIcons name="cart-outline" size={22} color={COLORS.white} />
              {cartItemCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Text>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionIcon} activeOpacity={0.8}>
          <MaterialCommunityIcons name="message-text-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SearchBar;

const styles = StyleSheet.create({
  container: {
    // backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(248, 246, 246, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    height: 44,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,106,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.35)',
  },
  cartIconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#D32F2F',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
