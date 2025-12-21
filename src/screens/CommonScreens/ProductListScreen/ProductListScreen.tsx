import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import httpClient from '../../../api/httpClient';
import { ProductStatus } from '../../../types/product';

const FALLBACK_IMAGE = 'https://placehold.co/600x400?text=Audio+Product';
const PAGE_SIZE = 20;
const DEFAULT_STATUS: ProductStatus = 'ACTIVE';
const ORANGE = '#FF6A00';

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
  ratingAverage?: number | null;
  reviewCount?: number | null;
  thumbnailUrl?: string | null;
  images?: string[];
  variants?: ProductViewVariant[];
  vouchers?: {
    platformVouchers?: {
      campaignId?: string;
      code?: string;
      name?: string;
      description?: string;
      campaignType?: 'FLASH_SALE' | 'MEGA_SALE' | string;
      status?: string;
      startTime?: string;
      endTime?: string;
      slotOpenTime?: string;
      slotCloseTime?: string;
      slotStatus?: string;
      vouchers?: {
        platformVoucherId?: string;
        campaignId?: string;
        type?: 'PERCENT' | 'FIXED';
        discountPercent?: number | null;
        discountValue?: number | null;
        maxDiscountValue?: number | null;
        minOrderValue?: number | null;
        usagePerUser?: number;
        startTime?: string;
        endTime?: string;
        status?: string;
        slotOpenTime?: string;
        slotCloseTime?: string;
        slotStatus?: string;
      }[];
    }[];
    shopVoucher?: {
      source?: string;
      shopVoucherId?: string;
      shopVoucherProductId?: string;
      code?: string;
      title?: string;
      discountValue?: number | null;
      discountPercent?: number | null;
      maxDiscountValue?: number | null;
      minOrderValue?: number | null;
      startTime?: string;
      endTime?: string;
    };
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

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const ProductListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [products, setProducts] = useState<ProductViewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const calculatePricing = (product: ProductViewItem) => {
    // Step 1: Xác định giá gốc (Original Price)
    let originalPrice = 0;
    if (product.variants && product.variants.length > 0) {
      const variantPrices = product.variants
        .map((v) => v.price ?? v.variantPrice ?? 0)
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v > 0);
      if (variantPrices.length > 0) {
        originalPrice = Math.min(...variantPrices);
      }
    }
    if (!originalPrice) {
      originalPrice = product.price ?? 0;
    }

    // Step 2: Kiểm tra campaign
    const hasCampaign =
      product.vouchers?.platformVouchers && product.vouchers.platformVouchers.length > 0;

    // Step 3: Xác định có cần tính toán discount không
    const needsCampaignCalculation =
      (product.discountPrice === null || product.discountPrice === undefined) &&
      (product.finalPrice === null ||
        product.finalPrice === undefined ||
        product.finalPrice === originalPrice) &&
      originalPrice > 0 &&
      hasCampaign;

    let discountedPrice = originalPrice;
    let hasDiscount = false;
    let discountPercent = 0;
    let campaignType: 'FLASH_SALE' | 'MEGA_SALE' | null = null;

    // Step 4-5: Kiểm tra và tính toán discount nếu cần
    if (needsCampaignCalculation) {
      const campaign = product.vouchers?.platformVouchers?.[0];
      const voucher = campaign?.vouchers?.[0];
      const now = new Date();

      if (campaign?.campaignType === 'FLASH_SALE' || campaign?.campaignType === 'MEGA_SALE') {
        campaignType = campaign.campaignType;
      }

      let isVoucherActive = false;

      if (voucher) {
        if (voucher.slotOpenTime && voucher.slotCloseTime) {
          const slotOpen = new Date(voucher.slotOpenTime);
          const slotClose = new Date(voucher.slotCloseTime);
          isVoucherActive =
            now >= slotOpen && now <= slotClose && voucher.slotStatus === 'ACTIVE';
        } else if (voucher.startTime && voucher.endTime) {
          const startTime = new Date(voucher.startTime);
          const endTime = new Date(voucher.endTime);
          isVoucherActive = now >= startTime && now <= endTime && voucher.status === 'ACTIVE';
        } else if (campaign?.startTime && campaign?.endTime) {
          const startTime = new Date(campaign.startTime);
          const endTime = new Date(campaign.endTime);
          isVoucherActive = now >= startTime && now <= endTime && voucher.status === 'ACTIVE';
        } else {
          isVoucherActive = voucher.status === 'ACTIVE';
        }
      }

      if (isVoucherActive && voucher) {
        if (voucher.type === 'PERCENT' && voucher.discountPercent) {
          const discountAmount = (originalPrice * voucher.discountPercent) / 100;
          const finalDiscount =
            voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
              ? Math.min(discountAmount, voucher.maxDiscountValue)
              : discountAmount;
          discountedPrice = Math.max(0, originalPrice - finalDiscount);
          discountPercent = voucher.discountPercent;
          hasDiscount = discountedPrice < originalPrice;
        } else if (voucher.type === 'FIXED' && voucher.discountValue) {
          discountedPrice = Math.max(0, originalPrice - voucher.discountValue);
          if (originalPrice > 0) {
            discountPercent = Math.round((voucher.discountValue / originalPrice) * 100);
          }
          hasDiscount = discountedPrice < originalPrice;
        }
      }
    } else if (hasCampaign) {
      discountedPrice =
        product.discountPrice ?? product.finalPrice ?? product.priceAfterPromotion ?? originalPrice;
      hasDiscount = discountedPrice < originalPrice && discountedPrice > 0;

      if (hasDiscount && originalPrice > 0) {
        discountPercent = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
      }

      const campaign = product.vouchers?.platformVouchers?.[0];
      if (campaign?.campaignType === 'FLASH_SALE' || campaign?.campaignType === 'MEGA_SALE') {
        campaignType = campaign.campaignType;
      }
    }

    if (discountedPrice === 0 && originalPrice > 0) {
      discountedPrice = originalPrice;
      hasDiscount = false;
    }

    if (discountPercent === 0 && originalPrice > 0 && discountedPrice > 0 && discountedPrice < originalPrice) {
      discountPercent = Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
    }

    let priceRange: { min: number; max: number } | null = null;
    if (product.variants && product.variants.length > 0) {
      const variantPrices = product.variants
        .map((v) => v.price ?? v.variantPrice ?? 0)
        .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v > 0);
      if (variantPrices.length > 0) {
        priceRange = {
          min: Math.min(...variantPrices),
          max: Math.max(...variantPrices),
        };
      }
    }

    return {
      originalPrice,
      discountedPrice,
      hasDiscount,
      discountPercent,
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

        const params: Record<string, any> = {
          status: DEFAULT_STATUS,
          page: pageNum,
          size: PAGE_SIZE,
        };

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
    [],
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleRefresh = useCallback(() => {
    setCurrentPage(0);
    setHasMore(true);
    loadProducts(true, 0, false);
  }, [loadProducts]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isRefreshing) {
      const nextPage = currentPage + 1;
      loadProducts(false, nextPage, true);
    }
  }, [isLoadingMore, hasMore, isRefreshing, currentPage, loadProducts]);

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
          priceRange,
          image: product.thumbnailUrl ?? product.images?.[0] ?? FALLBACK_IMAGE,
          rating: product.ratingAverage ?? 4.5,
        };
      }),
    [products],
  );

  const renderProductItem = ({ item }: { item: ProductCard }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => {
        // @ts-ignore - navigate to ProductDetail in ProductStack
        navigation.navigate('ProductDetail', { productId: item.id });
      }}
    >
      <Image source={{ uri: item.image }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {item.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.cardPrice, item.hasDiscount && styles.cardPriceDiscount]}>
            {item.priceRange
              ? `${formatCurrencyVND(item.priceRange.min)} - ${formatCurrencyVND(item.priceRange.max)}`
              : formatCurrencyVND(item.price)}
          </Text>
          {item.hasDiscount && item.originalPrice ? (
            <Text style={styles.cardPriceOriginal}>{formatCurrencyVND(item.originalPrice)}</Text>
          ) : null}
        </View>
        {item.hasDiscount && item.discountPercent ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-{item.discountPercent}%</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={ORANGE} />
        </View>
      );
    }
    return (
      <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore} disabled={isLoadingMore}>
        <Text style={styles.loadMoreText}>Xem thêm sản phẩm</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tất cả sản phẩm</Text>
        <View style={{ width: 30 }} />
      </View>

      {isLoading && products.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={styles.loaderText}>Đang tải sản phẩm...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadProducts()}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : productCards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Chưa có sản phẩm nào</Text>
        </View>
      ) : (
        <FlatList
          data={productCards}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={ORANGE} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
};

export default ProductListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: ORANGE,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#666',
    fontSize: 14,
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
    backgroundColor: ORANGE,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    maxWidth: '48%',
  },
  cardImage: {
    width: '100%',
    height: 130,
    backgroundColor: '#F0F0F0',
  },
  cardContent: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    minHeight: 40,
  },
  priceRow: {
    marginTop: 6,
  },
  cardPrice: {
    color: ORANGE,
    fontWeight: '700',
    fontSize: 14,
  },
  cardPriceDiscount: {
    color: '#D32F2F',
  },
  cardPriceOriginal: {
    marginTop: 2,
    color: '#888',
    textDecorationLine: 'line-through',
    fontSize: 12,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#D32F2F',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

