import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/color';

type Category = {
  id: number;
  name: string;
  image: string;
};

type Props = {
  title?: string;
  categories: Category[];
};

const CategorySection: React.FC<Props> = ({ title = 'Danh mục nổi bật', categories }) => {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 5 }}
      >
        {categories.map((cat) => (
          <TouchableOpacity key={cat.id} style={styles.categoryChip} activeOpacity={0.85}>
            <Image source={{ uri: cat.image }} style={styles.categoryImage} />
            <Text style={styles.categoryText}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

export default CategorySection;

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  categoryChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categoryImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  categoryText: {
    color: COLORS.text,
    fontWeight: '600',
  },
});

