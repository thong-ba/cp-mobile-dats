import { useNavigation } from '@react-navigation/native';
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
import httpClient from '../../../api/httpClient';
import {
  BannerCarousel,
  CategorySection,
  FlashSaleSection,
  HomeHeader,
  PopularSection,
  ProductGrid,
  RatingSection,
} from '../../../components/CommonScreenComponents/HomeScreenComponents';
import { ProductStatus } from '../../../types/product';

const FALLBACK_IMAGE = 'https://placehold.co/600x400?text=Audio+Product';
const FALLBACK_CATEGORY_IMAGE = 'https://placehold.co/80?text=CAT';
const PAGE_SIZE = 20;
const DEFAULT_STATUS: ProductStatus = 'ACTIVE';

type CategoryItem = {
  id: string;
  name: string;
  image: string;
};

type ProductViewVariant = {
  variantId: string;
  optionName?: string;
  optionValue?: string;
  variantSku?: string;
  price?: number;
  variantPrice?: number;
  stock?: number;
  imageUrl?: string;
};

type ProductViewItem = {
  productId: string;
  name: string;
  brandName?: string;
  price?: number | null;
  discountPrice?: number | null;
  finalPrice?: number | null;
  priceAfterPromotion?: number | null;
  category?: string;
  ratingAverage?: number | null;
  reviewCount?: number | null;
  thumbnailUrl?: string | null;
  images?: string[];
  variants?: ProductViewVariant[];
  vouchers?: {
    platformVouchers?: {
      status?: string;
      badgeLabel?: string;
      badgeColor?: string;
      badgeIconUrl?: string;
      startTime?: string;
      endTime?: string;
      slotOpenTime?: string;
      slotCloseTime?: string;
      slotStatus?: string;
      vouchers?: {
        type?: 'PERCENT' | 'FIXED';
        discountPercent?: number | null;
        discountValue?: number | null;
        maxDiscountValue?: number | null;
        startTime?: string;
        endTime?: string;
        status?: string;
      }[];
    }[];
  };
};

type ProductPageResponse = {
  status: number;
  message: string;
  data: {
    data: ProductViewItem[];
    page: {
      totalElements: number;
      pageNumber: number;
      pageSize: number;
      totalPages: number;
    };
  };
};

type ProductCard = {
  id: string;
  name: string;
  price: number;
  priceRange?: { min: number; max: number } | null;
  originalPrice?: number;
  hasDiscount?: boolean;
  image: string;
  rating?: number;
};

const HomeScreen = () => {
  const navigation = useNavigation();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductViewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const res = await httpClient.get<{ status: number; message: string; data: any[] }>(
        '/categories',
      );
      const mapped: CategoryItem[] = (res.data?.data ?? []).map((item) => ({
        id: item.categoryId ?? item.id ?? item.name,
        name: item.name,
        image: item.iconUrl || FALLBACK_CATEGORY_IMAGE,
      }));
      setCategories(mapped);
    } catch (error) {
      console.error('fetchCategories error', error);
    }
  }, []);

  const calculatePricing = (product: ProductViewItem) => {
    // Determine base/original price
    let originalPrice = 0;
    if (product.variants && product.variants.length > 0) {
      const variantPrices = product.variants
        .map((v) => v.price ?? v.variantPrice)
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
      if (variantPrices.length > 0) {
        originalPrice = Math.min(...variantPrices);
      }
    }
    if (!originalPrice) {
      originalPrice =
        product.price ??
        product.finalPrice ??
        product.priceAfterPromotion ??
        product.discountPrice ??
        0;
    }

    let discountedPrice = originalPrice;
    let hasDiscount = false;

    const firstCampaign = product.vouchers?.platformVouchers?.[0];
    const firstVoucher = firstCampaign?.vouchers?.[0];
    const now = new Date();

    const isCampaignActive =
      firstCampaign?.status === 'ACTIVE' &&
      (!firstCampaign.startTime || new Date(firstCampaign.startTime) <= now) &&
      (!firstCampaign.endTime || new Date(firstCampaign.endTime) >= now);

    const isVoucherActive =
      firstVoucher &&
      (firstVoucher.status === 'ACTIVE' || !firstVoucher.status) &&
      (!firstVoucher.startTime || new Date(firstVoucher.startTime) <= now) &&
      (!firstVoucher.endTime || new Date(firstVoucher.endTime) >= now);

    if (isCampaignActive && isVoucherActive && firstVoucher) {
      if (firstVoucher.type === 'PERCENT' && firstVoucher.discountPercent) {
        const discountValue = (originalPrice * firstVoucher.discountPercent) / 100;
        const capped =
          firstVoucher.maxDiscountValue !== null && firstVoucher.maxDiscountValue !== undefined
            ? Math.min(discountValue, firstVoucher.maxDiscountValue)
            : discountValue;
        discountedPrice = Math.max(0, originalPrice - capped);
      } else if (firstVoucher.type === 'FIXED' && firstVoucher.discountValue) {
        discountedPrice = Math.max(0, originalPrice - firstVoucher.discountValue);
      }
      hasDiscount = discountedPrice < originalPrice;
    }

    // Build price range if variants exist
    let priceRange: { min: number; max: number } | null = null;
    if (product.variants && product.variants.length > 0) {
      const variantPrices = product.variants
        .map((v) => v.price ?? v.variantPrice)
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
      if (variantPrices.length > 0) {
        priceRange = {
          min: Math.min(...variantPrices),
          max: Math.max(...variantPrices),
        };
      }
    }

    return { originalPrice, discountedPrice, hasDiscount, priceRange };
  };

  const loadProducts = useCallback(
    async (isPullRefresh = false) => {
      try {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);
        const response = await httpClient.get<ProductPageResponse>('/products/view', {
          params: {
          keyword: appliedKeyword || undefined,
            categoryId: selectedCategoryId || undefined,
          status: DEFAULT_STATUS,
          page: 0,
          size: PAGE_SIZE,
          },
        });
        const apiProducts = response.data?.data?.data ?? [];
        setProducts(apiProducts);
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
    [appliedKeyword, selectedCategoryId],
  );

  useEffect(() => {
    loadCategories();
    loadProducts();
  }, [loadProducts, loadCategories]);

  const bannerImages = useMemo(() => {
    const apiImages = products
      .flatMap((product) => product.images?.[0] ?? product.thumbnailUrl)
      .filter((image): image is string => Boolean(image));
    return apiImages.length > 0 ? apiImages : [FALLBACK_IMAGE];
  }, [products]);

  const productCards = useMemo(
    () =>
      products.map((product) => {
        const { discountedPrice, originalPrice, hasDiscount, priceRange } = calculatePricing(product);

        return {
        id: product.productId,
        name: product.name,
          price: discountedPrice,
          originalPrice,
          hasDiscount,
          priceRange,
          image: product.thumbnailUrl ?? product.images?.[0] ?? FALLBACK_IMAGE,
        rating: product.ratingAverage ?? 4.5,
        };
      }),
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
      setSelectedCategoryName(categoryName);
      if (!categoryName) {
        setSelectedCategoryId(null);
        return;
      }
      const found = categories.find(
        (cat) => cat.name.toLocaleLowerCase() === categoryName.toLocaleLowerCase(),
      );
      setSelectedCategoryId(found?.id ?? null);
    },
    [categories],
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
          categories={categories}
          selectedCategoryName={selectedCategoryName}
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
            <FlashSaleSection
              products={flashSaleProducts}
              onPressItem={(product) => {
                // @ts-ignore - navigate to ProductDetail in ProductStack
                navigation.navigate('ProductDetail', { productId: product.id });
              }}
            />
            <PopularSection
              products={popularProducts}
              onPressItem={(product) => {
                // @ts-ignore - navigate to ProductDetail in ProductStack
                navigation.navigate('ProductDetail', { productId: product.id });
              }}
            />
            <ProductGrid
              products={productCards}
              onPressItem={(product) => {
                // @ts-ignore - navigate to ProductDetail in ProductStack
                navigation.navigate('ProductDetail', { productId: product.id });
              }}
            />
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
