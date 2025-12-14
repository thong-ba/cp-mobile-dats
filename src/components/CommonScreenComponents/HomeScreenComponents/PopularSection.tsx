import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/color';

const ORANGE = '#FF6A00';

type Product = {
  id: string;
  name: string;
  price: number; // discounted price if hasDiscount, otherwise original
  priceRange?: { min: number; max: number } | null;
  originalPrice?: number;
  hasDiscount?: boolean;
  image: string;
};

type Props = {
  products: Product[];
  onPressItem?: (product: Product) => void;
};

const PopularSection: React.FC<Props> = ({ products, onPressItem }) => {
  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Phổ biến</Text>
        <Text style={styles.viewAll}>Xem tất cả</Text>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => onPressItem && onPressItem(item)}
          >
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
              <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
              <View style={styles.priceBlock}>
                <Text style={[styles.price, item.hasDiscount && styles.priceDiscount]}>
                  {item.priceRange
                    ? `${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.priceRange.min)} - ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.priceRange.max)}`
                    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
                </Text>
                {item.hasDiscount && item.originalPrice ? (
                  <Text style={styles.originalPrice}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.originalPrice)}
                  </Text>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default PopularSection;

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  viewAll: {
    color: ORANGE,
    fontWeight: '600',
  },
  card: {
    width: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  image: { width: '100%', height: 120 },
  name: { marginTop: 8, color: COLORS.text, fontWeight: '600' },
  price: { marginTop: 4, color: ORANGE, fontWeight: '700' },
  priceDiscount: { color: '#D32F2F' },
  originalPrice: {
    marginTop: 2,
    color: '#888',
    textDecorationLine: 'line-through',
    fontSize: 12,
  },
  priceBlock: {
    marginTop: 4,
    paddingBottom: 4,
  },
});

