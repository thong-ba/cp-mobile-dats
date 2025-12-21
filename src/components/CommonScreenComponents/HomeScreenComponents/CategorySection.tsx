import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/color';

type Props = {
  title?: string;
  categories: {
    id: number | string;
    name: string;
    image?: string;
    icon?: string;
  }[];
  selectedCategoryName?: string | null;
  onSelectCategory?: (categoryName: string | null) => void;
};

/**
 * Map category name to MaterialCommunityIcons icon name
 */
const getCategoryIcon = (categoryName: string): string => {
  const name = categoryName.toLowerCase();
  
  if (name.includes('loa') || name.includes('speaker')) {
    return 'speaker';
  }
  if (name.includes('tai nghe') || name.includes('headphone')) {
    return 'headphones';
  }
  if (name.includes('micro') || name.includes('mic')) {
    return 'microphone';
  }
  if (name.includes('dac') || name.includes('mixer') || name.includes('soundcard')) {
    return 'soundcloud';
  }
  if (name.includes('turntable') || name.includes('máy quay')) {
    return 'record-player';
  }
  if (name.includes('ampli') || name.includes('amp')) {
    return 'amplifier';
  }
  
  // Default icon
  return 'dots-grid';
};

const CategorySection: React.FC<Props> = ({
  title = 'Danh mục nổi bật',
  categories,
  selectedCategoryName,
  onSelectCategory,
}) => {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 5 }}
      >
        {categories.map((cat) => {
          const isSelected =
            selectedCategoryName &&
            cat.name.toLocaleLowerCase() === selectedCategoryName.toLocaleLowerCase();
          const iconName = cat.icon || getCategoryIcon(cat.name);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
              activeOpacity={0.85}
              onPress={() =>
                onSelectCategory?.(isSelected ? null : cat.name)
              }
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={iconName as any}
                  size={24}
                  color={isSelected ? COLORS.primary : '#666'}
                />
              </View>
              <Text
                style={[
                  styles.categoryText,
                  isSelected && styles.categoryTextSelected,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
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
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  categoryText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  categoryChipSelected: {
    backgroundColor: '#FFEFE6',
    borderColor: COLORS.primary,
  },
  categoryTextSelected: {
    color: COLORS.primary,
  },
});

