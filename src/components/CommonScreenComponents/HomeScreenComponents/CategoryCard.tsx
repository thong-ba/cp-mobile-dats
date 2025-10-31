import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/color';

type Props = {
  name: string;
};

const ORANGE = '#FF6A00';

const getIconName = (name: string): keyof typeof MaterialCommunityIcons.glyphMap => {
  const key = name.trim().toLowerCase();
  if (key.includes('tai nghe nhét tai') || key.includes('earbud')) return 'earbuds';
  if (key.includes('tai nghe') || key.includes('headphone')) return 'headphones';
  if (key.includes('micro')) return 'microphone';
  if (key.includes('loa') || key.includes('speaker')) return 'speaker';
  return 'dots-grid';
};

const CategoryCard: React.FC<Props> = ({ name }) => {
  const iconName = getIconName(name);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={iconName} size={28} color={ORANGE} />
      </View>
      <Text style={styles.text}>{name}</Text>
    </TouchableOpacity>
  );
};

export default CategoryCard;

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,106,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 5,
    color: COLORS.text,
    fontSize: 14,
  },
});
