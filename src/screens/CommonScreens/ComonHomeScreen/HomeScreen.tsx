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
      campaignType?: 'FLASH_SALE' | 'MEGA_SALE' | string;
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
        slotOpenTime?: string;
        slotCloseTime?: string;
        slotStatus?: string;
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
  discountPercent?: number;
  campaignType?: 'FLASH_SALE' | 'MEGA_SALE' | null;
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadCategories = useCallback(async () => {
    try {
      const res = await httpClient.get<{
        status: number;
        message: string;
        data: Array<{
          categoryId: string;
          name: string;
          children: Array<{
            categoryId: string;
            name: string;
            children: any[];
          }>;
        }>;
      }>('/categories/tree');

      // Flatten categories tree: include both parent and children categories
      const flattenCategories = (categories: typeof res.data.data): CategoryItem[] => {
        const result: CategoryItem[] = [];
        categories.forEach((category) => {
          // Add parent category
          result.push({
            id: category.categoryId,
            name: category.name,
            image: FALLBACK_CATEGORY_IMAGE,
          });
          // Add children categories if any
          if (category.children && category.children.length > 0) {
            category.children.forEach((child) => {
              result.push({
                id: child.categoryId,
                name: child.name,
                image: FALLBACK_CATEGORY_IMAGE,
              });
            });
          }
        });
        return result;
      };

      const mapped = flattenCategories(res.data?.data ?? []);
      setCategories(mapped);
    } catch (error: any) {
      console.error('fetchCategories error', error);
      // Set empty categories on error to prevent UI issues
      setCategories([]);
    }
  }, []);

  const calculatePricing = (product: ProductViewItem) => {
    // Step 1: Lấy tất cả giá từ variants (nếu có)
    const variantPrices: number[] = [];
    if (product.variants && product.variants.length > 0) {
      product.variants.forEach((v) => {
        const price = v.price ?? v.variantPrice ?? 0;
        if (typeof price === 'number' && !Number.isNaN(price) && price > 0) {
          variantPrices.push(price);
        }
      });
    }
    
    // Nếu không có variants, dùng product.price
    if (variantPrices.length === 0) {
      const productPrice = product.price ?? 0;
      if (productPrice > 0) {
        variantPrices.push(productPrice);
      }
    }

    // Nếu không có giá nào, return default
    if (variantPrices.length === 0) {
      return {
        originalPrice: 0,
        discountedPrice: 0,
        hasDiscount: false,
        discountPercent: 0,
        campaignType: null,
        priceRange: null,
      };
    }

    // Step 2: Kiểm tra campaign
    const hasCampaign =
      product.vouchers?.platformVouchers && product.vouchers.platformVouchers.length > 0;

    // Step 3: Xác định có cần tính toán discount không
    const needsCampaignCalculation =
      (product.discountPrice === null || product.discountPrice === undefined) &&
      (product.finalPrice === null ||
        product.finalPrice === undefined ||
        product.finalPrice === Math.min(...variantPrices)) &&
      hasCampaign;

    let discountedPrices: number[] = [];
    let hasDiscount = false;
    let discountPercent = 0;
    let campaignType: 'FLASH_SALE' | 'MEGA_SALE' | null = null;

    // Step 4-5: Tính discount cho TỪNG variant (nếu có campaign)
    if (needsCampaignCalculation) {
      const campaign = product.vouchers?.platformVouchers?.[0];
      const voucher = campaign?.vouchers?.[0];
      const now = new Date();

      // Xác định campaign type
      if (campaign?.campaignType === 'FLASH_SALE' || campaign?.campaignType === 'MEGA_SALE') {
        campaignType = campaign.campaignType;
      }

      let isVoucherActive = false;

      // Step 5: Kiểm tra voucher active
      if (voucher) {
        // Flash Sale: sử dụng slot time
        if (voucher.slotOpenTime && voucher.slotCloseTime) {
          const slotOpen = new Date(voucher.slotOpenTime);
          const slotClose = new Date(voucher.slotCloseTime);
          isVoucherActive =
            now >= slotOpen && now <= slotClose && voucher.slotStatus === 'ACTIVE';
        }
        // Mega Sale / Regular Campaign: sử dụng voucher time
        else if (voucher.startTime && voucher.endTime) {
          const startTime = new Date(voucher.startTime);
          const endTime = new Date(voucher.endTime);
          isVoucherActive = now >= startTime && now <= endTime && voucher.status === 'ACTIVE';
        }
        // Fallback: chỉ kiểm tra status
        else {
          isVoucherActive = voucher.status === 'ACTIVE';
        }
      }

      // Step 6: Áp dụng discount cho TỪNG variant nếu voucher active
      if (isVoucherActive && voucher) {
        discountedPrices = variantPrices.map((variantPrice) => {
          if (voucher.type === 'PERCENT' && voucher.discountPercent) {
            // Tính số tiền giảm
            const discountAmount = (variantPrice * voucher.discountPercent) / 100;

            // Áp dụng maxDiscountValue nếu có (giới hạn giảm tối đa)
            const finalDiscount =
              voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
                ? Math.min(discountAmount, voucher.maxDiscountValue)
                : discountAmount;

            // Tính giá cuối cùng cho variant này
            return Math.max(0, variantPrice - finalDiscount);
          } else if (voucher.type === 'FIXED' && voucher.discountValue) {
            // Tính giá cuối cùng cho variant này
            return Math.max(0, variantPrice - voucher.discountValue);
          }
          return variantPrice;
        });

        // Lấy giá giảm thấp nhất sau khi áp dụng discount
        const minDiscountedPrice = Math.min(...discountedPrices);
        const minOriginalPrice = Math.min(...variantPrices);
        
        hasDiscount = minDiscountedPrice < minOriginalPrice;
        discountPercent = voucher.discountPercent || 0;
      } else {
        // Voucher không active, không có discount
        discountedPrices = [...variantPrices];
      }
    } else if (hasCampaign) {
      // Backend đã tính sẵn, nhưng cần tính lại cho từng variant
      // Nếu có variants, tính discount cho từng variant
      if (product.variants && product.variants.length > 0) {
        // Backend có thể đã tính sẵn, nhưng ta cần tính lại cho từng variant
        const campaign = product.vouchers?.platformVouchers?.[0];
        const voucher = campaign?.vouchers?.[0];
        
        if (voucher) {
          discountedPrices = variantPrices.map((variantPrice) => {
            if (voucher.type === 'PERCENT' && voucher.discountPercent) {
              const discountAmount = (variantPrice * voucher.discountPercent) / 100;
              const finalDiscount =
                voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
                  ? Math.min(discountAmount, voucher.maxDiscountValue)
                  : discountAmount;
              return Math.max(0, variantPrice - finalDiscount);
            } else if (voucher.type === 'FIXED' && voucher.discountValue) {
              return Math.max(0, variantPrice - voucher.discountValue);
            }
            return variantPrice;
          });
        } else {
          discountedPrices = [...variantPrices];
        }

        const minDiscountedPrice = Math.min(...discountedPrices);
        const minOriginalPrice = Math.min(...variantPrices);
        hasDiscount = minDiscountedPrice < minOriginalPrice && minDiscountedPrice > 0;
        
        if (hasDiscount && minOriginalPrice > 0) {
          discountPercent = Math.round(((minOriginalPrice - minDiscountedPrice) / minOriginalPrice) * 100);
        }

        // Xác định campaign type
        if (campaign?.campaignType === 'FLASH_SALE' || campaign?.campaignType === 'MEGA_SALE') {
          campaignType = campaign.campaignType;
        }
      } else {
        // Không có variants, dùng giá từ backend
        const backendPrice = product.discountPrice ?? product.finalPrice ?? product.priceAfterPromotion ?? variantPrices[0];
        discountedPrices = [backendPrice];
        const minOriginalPrice = variantPrices[0];
        hasDiscount = backendPrice < minOriginalPrice && backendPrice > 0;
        
        if (hasDiscount && minOriginalPrice > 0) {
          discountPercent = Math.round(((minOriginalPrice - backendPrice) / minOriginalPrice) * 100);
        }

        const campaign = product.vouchers?.platformVouchers?.[0];
        if (campaign?.campaignType === 'FLASH_SALE' || campaign?.campaignType === 'MEGA_SALE') {
          campaignType = campaign.campaignType;
        }
      }
    } else {
      // Không có campaign, không có discount
      discountedPrices = [...variantPrices];
    }

    // Step 7: Lấy giá thấp nhất (cả original và discounted)
    const originalPrice = Math.min(...variantPrices);
    const discountedPrice = discountedPrices.length > 0 ? Math.min(...discountedPrices) : originalPrice;

    // Validation: Nếu discountedPrice = 0 nhưng originalPrice > 0, dùng originalPrice
    const finalDiscountedPrice = discountedPrice === 0 && originalPrice > 0 ? originalPrice : discountedPrice;
    const finalHasDiscount = finalDiscountedPrice < originalPrice && finalDiscountedPrice > 0;

    // Tính discountPercent nếu chưa có
    let finalDiscountPercent = discountPercent;
    if (finalDiscountPercent === 0 && originalPrice > 0 && finalDiscountedPrice > 0 && finalDiscountedPrice < originalPrice) {
      finalDiscountPercent = Math.round(((originalPrice - finalDiscountedPrice) / originalPrice) * 100);
    }

    // Build price range if variants exist
    let priceRange: { min: number; max: number } | null = null;
    if (product.variants && product.variants.length > 0) {
      if (variantPrices.length > 0) {
        priceRange = {
          min: Math.min(...variantPrices),
          max: Math.max(...variantPrices),
        };
      }
    }

    return {
      originalPrice,
      discountedPrice: finalDiscountedPrice,
      hasDiscount: finalHasDiscount,
      discountPercent: finalDiscountPercent,
      campaignType,
      priceRange,
    };
  };

  const loadProducts = useCallback(
    async (isPullRefresh = false, pageNum = 0, append = false) => {
      try {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);
        
        // Build query params with all supported filters
        const params: Record<string, any> = {
          status: DEFAULT_STATUS, // Filter by ACTIVE products only
          page: pageNum,
          size: PAGE_SIZE,
        };

        // Add optional filters
        if (appliedKeyword && appliedKeyword.trim()) {
          params.keyword = appliedKeyword.trim();
        }
        if (selectedCategoryId) {
          params.categoryId = selectedCategoryId;
        }
        // Sorting: default sort by name ascending
        params.sortBy = 'name';
        params.sortDir = 'asc';

        const response = await httpClient.get<ProductPageResponse>('/products/view', {
          params,
        });
        const apiProducts = response.data?.data?.data ?? [];
        const pageInfo = response.data?.data?.page;
        
        if (append) {
          setProducts((prev) => [...prev, ...apiProducts]);
        } else {
          setProducts(apiProducts);
        }
        
        // Update pagination state
        if (pageInfo) {
          setCurrentPage(pageInfo.pageNumber ?? pageNum);
          setTotalPages(pageInfo.totalPages ?? 0);
          setHasMore((pageInfo.pageNumber ?? pageNum) < (pageInfo.totalPages ?? 1) - 1);
        } else {
          setCurrentPage(pageNum);
          setHasMore(apiProducts.length === PAGE_SIZE);
        }
      } catch (error) {
        setErrorMessage('Không thể tải danh sách sản phẩm. Vui lòng thử lại.');
        console.error('fetchProducts error', error);
      } finally {
        if (isPullRefresh) {
          setIsRefreshing(false);
        } else if (append) {
          setIsLoadingMore(false);
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
  }, [loadCategories]);

  // Reset và load lại products khi filter thay đổi
  useEffect(() => {
    setCurrentPage(0);
    setHasMore(true);
    setProducts([]);
    loadProducts(false, 0, false);
  }, [appliedKeyword, selectedCategoryId, loadProducts]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isRefreshing) {
      const nextPage = currentPage + 1;
      loadProducts(false, nextPage, true);
    }
  }, [isLoadingMore, hasMore, isRefreshing, currentPage, loadProducts]);

  const bannerImages = useMemo(() => {
    const apiImages = products
      .flatMap((product) => product.images?.[0] ?? product.thumbnailUrl)
      .filter((image): image is string => Boolean(image));
    return apiImages.length > 0 ? apiImages : [FALLBACK_IMAGE];
  }, [products]);

  const productCards = useMemo(
    () =>
      products.map((product) => {
        const {
          discountedPrice,
          originalPrice,
          hasDiscount,
          discountPercent,
          campaignType,
          priceRange,
        } = calculatePricing(product);

        return {
          id: product.productId,
          name: product.name,
          price: discountedPrice,
          originalPrice,
          hasDiscount,
          discountPercent,
          campaignType,
          priceRange: null, // Luôn set null để chỉ hiển thị giá thấp nhất, không hiển thị range
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
            
            {/* Load More Section */}
            {hasMore && (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={() => {
                    // @ts-ignore - navigate to ProductList in ProductStack
                    navigation.navigate('ProductList');
                  }}
                >
                  <Text style={styles.loadMoreText}>Xem thêm sản phẩm</Text>
                </TouchableOpacity>
              </View>
            )}
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
  loadMoreContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FF6A00',
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
