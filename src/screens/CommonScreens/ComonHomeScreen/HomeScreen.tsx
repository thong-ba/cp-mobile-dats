import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BannerCarousel,
  CategorySection,
  FlashSaleSection,
  HomeHeader,
  PopularSection,
  ProductGrid,
  RatingSection,
} from '../../../components/CommonScreenComponents/HomeScreenComponents';
import { fetchProducts } from '../../../services/productService';
import { ProductResponseItem, ProductStatus } from '../../../types/product';

const API_CATEGORIES = [
  {
    id: 1,
    name: 'Tai Nghe',
    image: 'https://cdn.pixabay.com/photo/2017/03/12/13/41/headphones-2138288_1280.jpg',
  },
  {
    id: 2,
    name: 'Loa',
    image: 'https://cdn.pixabay.com/photo/2018/02/04/15/47/speaker-3123245_1280.jpg',
  },
  {
    id: 3,
    name: 'Micro',
    image: 'https://cdn.pixabay.com/photo/2016/11/29/06/18/microphone-1869398_1280.jpg',
  },
  {
    id: 4,
    name: 'DAC',
    image: 'https://images.pexels.com/photos/812264/pexels-photo-812264.jpeg',
  },
  {
    id: 5,
    name: 'Mixer',
    image: 'https://images.pexels.com/photos/164879/pexels-photo-164879.jpeg',
  },
  {
    id: 6,
    name: 'Amp',
    image: 'https://images.pexels.com/photos/164745/pexels-photo-164745.jpeg',
  },
  {
    id: 7,
    name: 'Turntable',
    image: 'https://images.pexels.com/photos/154147/pexels-photo-154147.jpeg',
  },
  {
    id: 8,
    name: 'Sound Card',
    image: 'https://images.pexels.com/photos/3394666/pexels-photo-3394666.jpeg',
  },
  {
    id: 9,
    name: 'DJ Controller',
    image: 'https://images.pexels.com/photos/164745/pexels-photo-164745.jpeg',
  },
  {
    id: 10,
    name: 'Combo',
    image: 'https://images.pexels.com/photos/164879/pexels-photo-164879.jpeg',
  },
];

const FALLBACK_IMAGE = 'https://placehold.co/600x400?text=Audio+Product';
const PAGE_SIZE = 20;
const DEFAULT_STATUS: ProductStatus = 'ACTIVE';

const HomeScreen = () => {
  const [searchInput, setSearchInput] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductResponseItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProducts = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);
        const response = await fetchProducts({
          keyword: appliedKeyword || undefined,
          categoryName: selectedCategory || undefined,
          status: DEFAULT_STATUS,
          page: 0,
          size: PAGE_SIZE,
        });
        setProducts(response.data ?? []);
      } catch (error) {
        setErrorMessage('Không thể tải danh sách sản phẩm. Vui lòng thử lại.');
        console.error('fetchProducts error', error);
      } finally {
        if (isPullRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [appliedKeyword, selectedCategory],
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const bannerImages = useMemo(() => {
    const apiImages = products
      .flatMap((product) => product.images?.[0])
      .filter((image): image is string => Boolean(image));
    return apiImages.length > 0 ? apiImages : [FALLBACK_IMAGE];
  }, [products]);

  const productCards = useMemo(
    () =>
      products.map((product) => ({
        id: product.productId,
        name: product.name,
        price:
          product.finalPrice ??
          product.priceAfterPromotion ??
          product.price ??
          0,
        image: product.images?.[0] ?? FALLBACK_IMAGE,
        rating: product.ratingAverage ?? 4.5,
      })),
    [products],
  );

  const flashSaleProducts = useMemo(() => productCards.slice(0, 8), [productCards]);
  const popularProducts = useMemo(() => productCards.slice(0, 10), [productCards]);
  const ratingItems = useMemo(
    () =>
      productCards.slice(0, 10).map((item, index) => ({
        id: `${item.id}-${index}`,
        name: item.name,
        image: item.image,
        rating: item.rating,
      })),
    [productCards],
  );

  const handleSubmitSearch = useCallback(() => {
    setAppliedKeyword(searchInput.trim());
  }, [searchInput]);

  const handleSelectCategory = useCallback(
    (categoryName: string | null) => {
      setSelectedCategory(categoryName);
    },
    [],
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{errorMessage}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => loadProducts()}>
        <Text style={styles.retryText}>Thử lại</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <HomeHeader
        keyword={searchInput}
        onKeywordChange={setSearchInput}
        onSubmitSearch={handleSubmitSearch}
        isSearching={isLoading && products.length === 0}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadProducts(true)} />
        }
      >
        <CategorySection
          categories={API_CATEGORIES}
          selectedCategoryName={selectedCategory}
          onSelectCategory={handleSelectCategory}
        />
        {isLoading && products.length === 0 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#FF6A00" />
            <Text style={styles.loaderText}>Đang tải sản phẩm...</Text>
          </View>
        ) : errorMessage ? (
          renderErrorState()
        ) : productCards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Chưa có sản phẩm nào</Text>
            <Text style={styles.emptySubtitle}>
              Hãy thử đổi từ khóa tìm kiếm hoặc chọn danh mục khác.
            </Text>
          </View>
        ) : (
          <>
            <BannerCarousel banners={bannerImages} />
            <FlashSaleSection products={flashSaleProducts} />
            <PopularSection products={popularProducts} />
            <ProductGrid products={productCards} />
            <RatingSection items={ratingItems} />
          </>
        )}
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
  loaderContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#555',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFF4F2',
    borderWidth: 1,
    borderColor: '#FFD4CC',
    alignItems: 'center',
  },
  errorText: {
    color: '#B3261E',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FF6A00',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#555',
  },
});
