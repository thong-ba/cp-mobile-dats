import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useAuth } from '../../../context/AuthContext';
import { ProductStackParamList } from '../../../navigation/ProductStackNavigator';
import { ProductStatus } from '../../../types/product';

// Constants
const FALLBACK_IMAGE = 'https://placehold.co/600x400?text=Audio+Product';
const FALLBACK_CATEGORY_IMAGE = 'https://placehold.co/80?text=CAT';
const PAGE_SIZE = 20;
const DEFAULT_STATUS: ProductStatus = 'ACTIVE';
const WELCOME_MESSAGE_STORAGE_KEY = 'welcomeMessage';

// AsyncStorage import
const AsyncStorage: any =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@react-native-async-storage/async-storage').default;

// Types
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

type WelcomeMessageData = {
  userName: string;
  showWelcome: boolean;
};

type HomeScreenNavigationProp = NativeStackNavigationProp<ProductStackParamList, 'Home'>;

/**
 * HomeScreen Component
 * 
 * Main home screen displaying:
 * - Category navigation
 * - Product banners
 * - Flash sale section
 * - Popular products
 * - Product grid
 * - Rating section
 * 
 * Features:
 * - Welcome message handler (from AsyncStorage)
 * - Pull-to-refresh
 * - Search and filter
 * - Pagination support
 * - Error handling
 */
const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { authState, isAuthenticated } = useAuth();

  // State Management
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

  // Welcome Message State
  const [welcomeSnackbarVisible, setWelcomeSnackbarVisible] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string>('');

  // Refs
  const welcomeTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * ============================================
   * SECTION 1: Welcome Message Handler
   * ============================================
   * 
   * Handles welcome message display after login
   * Reads from AsyncStorage and shows Snackbar notification
   */
  useEffect(() => {
    const checkWelcomeMessage = async () => {
      try {
        const welcomeDataStr = await AsyncStorage.getItem(WELCOME_MESSAGE_STORAGE_KEY);
        
        if (welcomeDataStr) {
          try {
            const welcomeData: WelcomeMessageData = JSON.parse(welcomeDataStr);
            
            if (welcomeData.showWelcome && welcomeData.userName) {
              // Set welcome message
              setWelcomeMessage(`Chào mừng ${welcomeData.userName} trở lại!`);
              setWelcomeSnackbarVisible(true);
              
              // Clear from storage after showing
              await AsyncStorage.removeItem(WELCOME_MESSAGE_STORAGE_KEY);
              
              // Auto hide after 3 seconds
              if (welcomeTimerRef.current) {
                clearTimeout(welcomeTimerRef.current);
              }
              welcomeTimerRef.current = setTimeout(() => {
                setWelcomeSnackbarVisible(false);
              }, 3000);
            } else {
              // Invalid data, remove it
              await AsyncStorage.removeItem(WELCOME_MESSAGE_STORAGE_KEY);
            }
          } catch (parseError) {
            console.error('[HomeScreen] Error parsing welcome message:', parseError);
            // Invalid JSON, remove it
            await AsyncStorage.removeItem(WELCOME_MESSAGE_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('[HomeScreen] Error reading welcome message:', error);
        // On error, try to clean up
        try {
          await AsyncStorage.removeItem(WELCOME_MESSAGE_STORAGE_KEY);
        } catch (cleanupError) {
          console.error('[HomeScreen] Error cleaning up welcome message:', cleanupError);
        }
      }
    };

    // Only check welcome message if user is authenticated
    if (isAuthenticated) {
      checkWelcomeMessage();
    }

    // Cleanup on unmount
    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
      }
    };
  }, [isAuthenticated]);

  /**
   * ============================================
   * SECTION 2: Category Loading
   * ============================================
   * 
   * Loads category tree from API and flattens it
   * Includes both parent and child categories
   */
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
      console.error('[HomeScreen] fetchCategories error', error);
      // Set empty categories on error to prevent UI issues
      setCategories([]);
    }
  }, []);

  /**
   * ============================================
   * SECTION 3: Price Calculation Logic
   * ============================================
   * 
   * Complex pricing logic that handles:
   * - Variant pricing
   * - Campaign discounts (FLASH_SALE, MEGA_SALE)
   * - Voucher calculations (PERCENT, FIXED)
   * - Price range for variants
   * 
   * Returns single lowest price (not range) for display
   */
  const calculatePricing = useCallback((product: ProductViewItem) => {
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

    // Build price range if variants exist (but we'll set it to null for display)
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
  }, []);

  /**
   * ============================================
   * SECTION 4: Product Loading
   * ============================================
   * 
   * Loads products with pagination, search, and category filters
   * Supports pull-to-refresh and load more
   */
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
        const errorMsg = 'Không thể tải danh sách sản phẩm. Vui lòng thử lại.';
        setErrorMessage(errorMsg);
        console.error('[HomeScreen] fetchProducts error', error);
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

  /**
   * ============================================
   * SECTION 5: Effects & Lifecycle
   * ============================================
   */
  
  // Initial load: categories and products
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

  /**
   * ============================================
   * SECTION 6: Event Handlers
   * ============================================
   */
  
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isRefreshing) {
      const nextPage = currentPage + 1;
      loadProducts(false, nextPage, true);
    }
  }, [isLoadingMore, hasMore, isRefreshing, currentPage, loadProducts]);

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

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    loadProducts();
  }, [loadProducts]);

  /**
   * ============================================
   * SECTION 7: Memoized Computed Values
   * ============================================
   */
  
  // Banner images from products
  const bannerImages = useMemo(() => {
    const apiImages = products
      .flatMap((product) => product.images?.[0] ?? product.thumbnailUrl)
      .filter((image): image is string => Boolean(image));
    return apiImages.length > 0 ? apiImages : [FALLBACK_IMAGE];
  }, [products]);

  // Product cards with calculated pricing
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
    [products, calculatePricing],
  );

  // Flash sale products - filter by campaignType === 'FLASH_SALE'
  const flashSaleProducts = useMemo(() => {
    // Filter products that have FLASH_SALE campaign
    const flashSaleItems = products
      .map((product) => {
        const {
          discountedPrice,
          originalPrice,
          hasDiscount,
          discountPercent,
          campaignType,
          priceRange,
        } = calculatePricing(product);

        // Only include products with FLASH_SALE campaign
        if (campaignType !== 'FLASH_SALE') {
          return null;
        }

        return {
          id: product.productId,
          name: product.name,
          price: discountedPrice,
          originalPrice,
          hasDiscount,
          discountPercent,
          campaignType,
          priceRange: null, // Always set null to show single price
          image: product.thumbnailUrl ?? product.images?.[0] ?? FALLBACK_IMAGE,
          rating: product.ratingAverage ?? 4.5,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 8); // Limit to 8 products

    return flashSaleItems;
  }, [products, calculatePricing]);

  // Calculate flash sale countdown time from slot time
  const flashSaleEndTime = useMemo(() => {
    if (flashSaleProducts.length === 0) {
      return null;
    }

    // Find the earliest slot close time from all flash sale products
    const slotTimes = flashSaleProducts
      .map((product) => {
        // Find the product in original products array to get slot time
        const originalProduct = products.find((p) => p.productId === product.id);
        if (!originalProduct) return null;

        const voucher = originalProduct.vouchers?.platformVouchers?.[0]?.vouchers?.[0];
        if (!voucher?.slotCloseTime) return null;

        return new Date(voucher.slotCloseTime).getTime();
      })
      .filter((time): time is number => time !== null);

    if (slotTimes.length === 0) {
      return null;
    }

    // Return the earliest (minimum) slot close time
    const earliestTime = Math.min(...slotTimes);
    const now = Date.now();
    const remaining = Math.max(0, earliestTime - now);

    return remaining;
  }, [flashSaleProducts, products]);

  // Popular products (first 10)
  const popularProducts = useMemo(() => productCards.slice(0, 10), [productCards]);

  // Rating items (first 10)
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

  /**
   * ============================================
   * SECTION 8: Render Helpers
   * ============================================
   */
  
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{errorMessage}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
        <Text style={styles.retryText}>Thử lại</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loaderContainer}>
      <ActivityIndicator size="large" color="#FF6A00" />
      <Text style={styles.loaderText}>Đang tải sản phẩm...</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>Chưa có sản phẩm nào</Text>
      <Text style={styles.emptySubtitle}>
        Hãy thử đổi từ khóa tìm kiếm hoặc chọn danh mục khác.
      </Text>
    </View>
  );

  const renderContent = () => {
    if (isLoading && products.length === 0) {
      return renderLoadingState();
    }

    if (errorMessage) {
      return renderErrorState();
    }

    if (productCards.length === 0) {
      return renderEmptyState();
    }

    return (
      <>
        <BannerCarousel banners={bannerImages} />
        {flashSaleProducts.length > 0 && (
          <FlashSaleSection
            products={flashSaleProducts}
            endsInMs={flashSaleEndTime ?? undefined}
            onPressItem={(product) => {
              navigation.navigate('ProductDetail', { productId: product.id });
            }}
          />
        )}
        <PopularSection
          products={popularProducts}
          onPressItem={(product) => {
            navigation.navigate('ProductDetail', { productId: product.id });
          }}
          onPressViewAll={() => {
            navigation.navigate('ProductList');
          }}
        />
        <ProductGrid
          products={productCards}
          onPressItem={(product) => {
            navigation.navigate('ProductDetail', { productId: product.id });
          }}
          onPressViewAll={() => {
            navigation.navigate('ProductList');
          }}
        />
        <RatingSection items={ratingItems} />
        
        {/* Load More Section */}
        {hasMore && (
          <View style={styles.loadMoreContainer}>
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() => {
                navigation.navigate('ProductList');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.loadMoreText}>Xem thêm sản phẩm</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  /**
   * ============================================
   * SECTION 9: Main Render
   * ============================================
   */
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <HomeHeader
          keyword={searchInput}
          onKeywordChange={setSearchInput}
          onSubmitSearch={handleSubmitSearch}
          isSearching={isLoading && products.length === 0}
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadProducts(true)}
              colors={['#FF6A00']}
              tintColor="#FF6A00"
            />
          }
        >
          <CategorySection
            categories={categories}
            selectedCategoryName={selectedCategoryName}
            onSelectCategory={handleSelectCategory}
          />
          {renderContent()}
        </ScrollView>

        {/* Welcome Message Snackbar */}
        <Snackbar
          visible={welcomeSnackbarVisible}
          onDismiss={() => setWelcomeSnackbarVisible(false)}
          duration={3000}
          style={styles.welcomeSnackbar}
          action={{
            label: 'Đóng',
            onPress: () => setWelcomeSnackbarVisible(false),
          }}
        >
          {welcomeMessage}
        </Snackbar>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;

/**
 * ============================================
 * SECTION 10: Styles
 * ============================================
 */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loaderContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 16,
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFF4F2',
    borderWidth: 1,
    borderColor: '#FFD4CC',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorText: {
    color: '#B3261E',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
    fontSize: 15,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FF6A00',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyContainer: {
    paddingVertical: 48,
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
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
  },
  loadMoreContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#FF6A00',
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  welcomeSnackbar: {
    backgroundColor: '#4CAF50',
    marginBottom: 16,
  },
});
