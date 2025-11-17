import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../../../constants/color';

type Rated = {
  id: string;
  name: string;
  image: string;
  rating: number; // 0..5
};

type Props = {
  items: Rated[];
};

const RatingSection: React.FC<Props> = ({ items }) => {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.title}>Đánh giá cao</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Image source={{ uri: item.image }} style={styles.avatar} />
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            <View style={styles.stars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <MaterialCommunityIcons
                  key={i}
                  name={i < Math.round(item.rating) ? 'star' : 'star-outline'}
                  color={i < Math.round(item.rating) ? '#FFA800' : '#D0D0D0'}
                  size={16}
                />
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );
};

export default RatingSection;

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  item: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    padding: 10,
  },
  avatar: { width: 80, height: 80, borderRadius: 8 },
  name: { marginTop: 8, color: COLORS.text, fontWeight: '600' },
  stars: { flexDirection: 'row', marginTop: 4 },
});

