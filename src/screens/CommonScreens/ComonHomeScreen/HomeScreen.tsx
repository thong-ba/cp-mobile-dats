import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
    BannerCarousel,
    CategorySection,
    FlashSaleSection,
    HomeHeader,
    PopularSection,
    ProductGrid,
    RatingSection,
} from '../../../components/CommonScreenComponents/HomeScreenComponents';
import { banners, categories, moreProducts, products } from '../../../constants/dummyData';

const bannerImages = banners.map((b) => b.image);

const HomeScreen = () => {
  return (
    <View style={styles.container}>
      <HomeHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <CategorySection categories={categories} />
        <BannerCarousel banners={bannerImages} />
        <FlashSaleSection products={[...products, ...moreProducts]} />
        <PopularSection products={[...moreProducts, ...products]} />
        <ProductGrid products={[...products, ...moreProducts]} />
        <RatingSection
          items={[...products, ...moreProducts].map((p, idx) => ({
            id: p.id,
            name: p.name,
            image: p.image,
            rating: 3 + ((idx % 3) + 1) * 0.5,
          }))}
        />
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
});
