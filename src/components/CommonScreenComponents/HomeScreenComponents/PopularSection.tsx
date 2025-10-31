import React from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/color';

const ORANGE = '#FF6A00';

type Product = {
  id: number;
  name: string;
  price: number;
  image: string;
};

type Props = {
  products: Product[];
};

const PopularSection: React.FC<Props> = ({ products }) => {
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
          <TouchableOpacity style={styles.card} activeOpacity={0.9}>
            <Image source={{ uri: item.image }} style={styles.image} />
            <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
              <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
              <Text style={styles.price}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}</Text>
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
});

