import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/color';

const ORANGE = '#FF6A00';

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
};

type Props = {
  title?: string;
  products: Product[];
  onPressItem?: (product: Product) => void;
};

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
    value,
  );

const ProductGrid: React.FC<Props> = ({ title = 'Sản phẩm nổi bật', products, onPressItem }) => {
  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>Xem tất cả</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 12, gap: 12 }}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => onPressItem && onPressItem(item)}
          >
            <Image source={{ uri: item.image }} style={styles.cardImage} />
            <View style={{ paddingHorizontal: 10, paddingBottom: 12 }}>
              <Text numberOfLines={2} style={styles.cardTitle}>
                {item.name}
              </Text>
              <Text style={styles.cardPrice}>{formatCurrencyVND(item.price)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default ProductGrid;

const styles = StyleSheet.create({
  sectionHeaderRow: {
    marginTop: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  viewAll: {
    color: ORANGE,
    fontWeight: '600',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 130,
  },
  cardTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  cardPrice: {
    marginTop: 6,
    color: ORANGE,
    fontWeight: '700',
  },
});

