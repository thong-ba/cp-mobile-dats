import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

type BannerCarouselProps = {
  banners: string[];
};

const BannerCarousel: React.FC<BannerCarouselProps> = ({ banners }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      pagingEnabled
      snapToAlignment="center"
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 16 }}
      style={{ marginTop: 12 }}
    >
      {banners.map((uri, idx) => (
        <Image key={idx} source={{ uri }} style={styles.banner} resizeMode="cover" />
      ))}
      <View style={{ width: 4 }} />
    </ScrollView>
  );
};

export default BannerCarousel;

const styles = StyleSheet.create({
  banner: {
    width: width - 32,
    height: Math.round((width - 32) * 0.45),
    borderRadius: 14,
    marginRight: 12,
  },
});
