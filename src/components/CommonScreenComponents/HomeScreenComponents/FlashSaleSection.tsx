import React, { useEffect, useMemo, useState } from 'react';
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
  endsInMs?: number; // countdown duration in ms
};

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const FlashSaleSection: React.FC<Props> = ({ products, endsInMs = 3 * 60 * 60 * 1000 }) => {
  const [remaining, setRemaining] = useState<number>(endsInMs);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const rest = Math.max(0, endsInMs - elapsed);
      setRemaining(rest);
    }, 1000);
    return () => clearInterval(id);
  }, [endsInMs]);

  const time = useMemo(() => {
    const totalSeconds = Math.floor(remaining / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [remaining]);

  return (
    <View style={{ marginTop: 16 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Flash sale</Text>
        <View style={styles.countdown}><Text style={styles.countdownText}>{time}</Text></View>
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
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

export default FlashSaleSection;

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  countdown: {
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countdownText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  card: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 110,
  },
  name: {
    marginTop: 8,
    paddingHorizontal: 10,
    color: COLORS.text,
    fontWeight: '600',
  },
  price: {
    marginTop: 4,
    paddingHorizontal: 10,
    color: ORANGE,
    fontWeight: '700',
  },
});

