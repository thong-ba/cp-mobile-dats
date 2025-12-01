import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CartItem } from '../../../types/cart';

const ORANGE = '#FF6A00';

type Props = {
  items: CartItem[];
  onCartChange?: () => void;
};

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const CartItemList: React.FC<Props> = ({ items, onCartChange }) => {
  const handleQuantityChange = (cartItemId: string, newQuantity: number) => {
    // TODO: Implement update cart item quantity API
    console.log('Update quantity', cartItemId, newQuantity);
    onCartChange?.();
  };

  const handleRemoveItem = (cartItemId: string) => {
    // TODO: Implement remove cart item API
    console.log('Remove item', cartItemId);
    onCartChange?.();
  };

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <View key={item.cartItemId} style={styles.itemCard}>
          <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="contain" />
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            {item.variantOptionName && item.variantOptionValue && (
              <Text style={styles.variantText}>
                {item.variantOptionName}: {item.variantOptionValue}
              </Text>
            )}
            <Text style={styles.itemPrice}>{formatCurrencyVND(item.unitPrice)}</Text>

            <View style={styles.quantityRow}>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => {
                    if (item.quantity > 1) {
                      handleQuantityChange(item.cartItemId, item.quantity - 1);
                    }
                  }}
                  disabled={item.quantity <= 1}
                >
                  <MaterialCommunityIcons
                    name="minus"
                    size={18}
                    color={item.quantity <= 1 ? '#CCCCCC' : ORANGE}
                  />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleQuantityChange(item.cartItemId, item.quantity + 1)}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={ORANGE} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveItem(item.cartItemId)}
              >
                <MaterialCommunityIcons name="delete-outline" size={20} color="#B3261E" />
              </TouchableOpacity>
            </View>
            <View style={styles.lineTotalRow}>
              <Text style={styles.lineTotalLabel}>Thành tiền:</Text>
              <Text style={styles.lineTotalValue}>{formatCurrencyVND(item.lineTotal)}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

export default CartItemList;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  itemImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  itemInfo: {
    flex: 1,
    gap: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  variantText: {
    fontSize: 13,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '700',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityButton: {
    padding: 4,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    padding: 4,
  },
  lineTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  lineTotalLabel: {
    fontSize: 14,
    color: '#666',
  },
  lineTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ORANGE,
  },
});

