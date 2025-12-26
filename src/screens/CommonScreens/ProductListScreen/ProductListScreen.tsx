import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Menu, Portal, Searchbar, Snackbar } from 'react-native-paper';
import httpClient from '../../../api/httpClient';
import { getActiveProvinces } from '../../../services/ghnService';
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
    data?: ProductViewItem[];
    content?: ProductViewItem[];
    page?: {
      pageNumber: number;
      pageSize: number;
      totalPages: number;
      totalElements: number;
    };
    pageNumber?: number;
    pageSize?: number;
    totalPages?: number;
    totalElements?: number;
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

type CategoryItem = {
  categoryId: string;
  name: string;
};

type ProvinceItem = {
  ProvinceID: number;
  ProvinceName: string;
};

interface ProductListFilters {
  categoryId?: string;
  categoryName?: string;
  keyword?: string;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  provinceCode?: string;
  sortBy?: 'name' | 'price';
  sortDir?: 'asc' | 'desc';
}

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const formatNumber = (value: string): string => {
  // Remove non-digit characters
  const digits = value.replace(/\D/g, '');
  // Format with commas
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const parseNumber = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
};

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

  // Filter states
  const [filters, setFilters] = useState<ProductListFilters>({
    status: DEFAULT_STATUS,
  });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [provinces, setProvinces] = useState<ProvinceItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  
  // Price range inputs (formatted display)
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [priceError, setPriceError] = useState<string | null>(null);
  
  // Sort menu
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [selectedSort, setSelectedSort] = useState<string>('default');
  
  // Province menu
  const [provinceMenuVisible, setProvinceMenuVisible] = useState(false);
  
  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Snackbar
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      setIsLoadingCategories(true);
      const res = await httpClient.get<{
        status: number;
        message: string;
        data: Array<{
          categoryId: string;
          name: string;
          children: Array<{
            categoryId: string;
            name: string;
          }>;
        }>;
      }>('/categories/tree');

      const flattenCategories = (categories: typeof res.data.data): CategoryItem[] => {
        const result: CategoryItem[] = [];
        categories.forEach((category) => {
          result.push({
            categoryId: category.categoryId,
            name: category.name,
          });
          if (category.children && category.children.length > 0) {
            category.children.forEach((child) => {
              result.push({
                categoryId: child.categoryId,
                name: child.name,
              });
            });
          }
        });
        return result;
      };

      const mapped = flattenCategories(res.data?.data ?? []);
      setCategories(mapped.slice(0, 6)); // Limit to 6 categories
    } catch (error) {
      console.error('[ProductListScreen] Failed to load categories:', error);
      setCategories([]);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  // Load provinces
  const loadProvinces = useCallback(async () => {
    try {
      setIsLoadingProvinces(true);
      const activeProvinces = await getActiveProvinces();
      setProvinces(activeProvinces);
    } catch (error) {
      console.error('[ProductListScreen] Failed to load provinces:', error);
      setProvinces([]);
    } finally {
      setIsLoadingProvinces(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadProvinces();
  }, [loadCategories, loadProvinces]);

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

    return {
      originalPrice,
      discountedPrice: finalDiscountedPrice,
      hasDiscount: finalHasDiscount,
      discountPercent: finalDiscountPercent,
      campaignType,
      priceRange: null,
    };
  };

  // Build API params from filters
  const buildApiParams = useCallback((pageNum: number = 0, append: boolean = false) => {
    const params: Record<string, any> = {
      status: filters.status || DEFAULT_STATUS,
      page: pageNum,
      size: PAGE_SIZE,
    };

    if (filters.categoryId) {
      params.categoryId = filters.categoryId;
    } else if (filters.categoryName) {
      params.categoryName = filters.categoryName;
    }

    if (filters.keyword?.trim()) {
      params.keyword = filters.keyword.trim();
    }

    if (filters.minPrice !== undefined && filters.minPrice !== null && filters.minPrice > 0) {
      params.minPrice = filters.minPrice;
    }

    if (filters.maxPrice !== undefined && filters.maxPrice !== null && filters.maxPrice > 0) {
      params.maxPrice = filters.maxPrice;
    }

    if (filters.minRating !== undefined && filters.minRating !== null && filters.minRating > 0) {
      params.minRating = filters.minRating;
    }

    if (filters.provinceCode) {
      params.provinceCode = filters.provinceCode;
    }

    if (filters.sortBy) {
      params.sortBy = filters.sortBy;
    }

    if (filters.sortDir) {
      params.sortDir = filters.sortDir;
    }

    return params;
  }, [filters]);

  // Normalize API response
  const normalizeResponse = useCallback((response: ProductPageResponse, pageNum: number) => {
    let apiProducts: ProductViewItem[] = [];
    let pageInfo: {
      pageNumber: number;
      pageSize: number;
      totalPages: number;
      totalElements: number;
    } | null = null;

    // Format 1: { data: { data: Product[], page: {...} } }
    if (response.data?.data && Array.isArray(response.data.data)) {
      apiProducts = response.data.data;
      if (response.data.page) {
        pageInfo = response.data.page;
      }
    }
    // Format 2: { data: { content: Product[], ...pagination } }
    else if (response.data?.content && Array.isArray(response.data.content)) {
      apiProducts = response.data.content;
      pageInfo = {
        pageNumber: response.data.pageNumber ?? pageNum,
        pageSize: response.data.pageSize ?? PAGE_SIZE,
        totalPages: response.data.totalPages ?? 0,
        totalElements: response.data.totalElements ?? 0,
      };
    }
    // Format 3: Direct array (fallback)
    else if (Array.isArray(response.data)) {
      apiProducts = response.data;
      pageInfo = {
        pageNumber: pageNum,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(apiProducts.length / PAGE_SIZE),
        totalElements: apiProducts.length,
      };
    }

    return { apiProducts, pageInfo };
  }, []);

  const loadProducts = useCallback(
    async (isPullRefresh = false, pageNum = 0, append = false) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController
      abortControllerRef.current = new AbortController();

      try {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);

        const params = buildApiParams(pageNum, append);

        const response = await httpClient.get<ProductPageResponse | ProductViewItem[]>(
          '/products/view',
          {
            params,
            signal: abortControllerRef.current.signal,
          },
        );

        // Normalize response
        let apiProducts: ProductViewItem[] = [];
        let pageInfo: {
          pageNumber: number;
          pageSize: number;
          totalPages: number;
          totalElements: number;
        } | null = null;

        if (Array.isArray(response.data)) {
          // Format 3: Direct array
          apiProducts = response.data;
          pageInfo = {
            pageNumber: pageNum,
            pageSize: PAGE_SIZE,
            totalPages: Math.ceil(apiProducts.length / PAGE_SIZE),
            totalElements: apiProducts.length,
          };
        } else {
          // Format 1 or 2
          const normalized = normalizeResponse(response.data as ProductPageResponse, pageNum);
          apiProducts = normalized.apiProducts;
          pageInfo = normalized.pageInfo;
        }

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
      } catch (error: any) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
          // Request was cancelled, ignore
          return;
        }
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
    [buildApiParams, normalizeResponse],
  );

  // Debounced load products
  const debouncedLoadProducts = useCallback(
    (pageNum = 0, append = false) => {
      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        loadProducts(false, pageNum, append);
      }, 300);
    },
    [loadProducts],
  );

  // Initial load
  useEffect(() => {
    loadProducts();
  }, []); // Only on mount

  // Debounced reload when filters change
  useEffect(() => {
    // Reset to page 0 when filters change
    setCurrentPage(0);
    setHasMore(true);
    debouncedLoadProducts(0, false);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [filters, debouncedLoadProducts]);

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

  // Filter handlers
  const handleCategoryToggle = useCallback((categoryId: string, categoryName: string) => {
    setFilters((prev) => {
      if (prev.categoryId === categoryId) {
        // Deselect
        const { categoryId: _, categoryName: __, ...rest } = prev;
        return rest;
      } else {
        // Select
        return {
          ...prev,
          categoryId,
          categoryName,
        };
      }
    });
  }, []);

  const handlePriceRangeApply = useCallback(() => {
    const minPrice = minPriceInput ? parseNumber(minPriceInput) : undefined;
    const maxPrice = maxPriceInput ? parseNumber(maxPriceInput) : undefined;

    // Validation
    if (minPrice === 0 && maxPrice === 0) {
      setPriceError('Vui lòng nhập ít nhất một giá trị');
      return;
    }

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      setPriceError('Giá tối thiểu không được lớn hơn giá tối đa');
      return;
    }

    setPriceError(null);
    setFilters((prev) => ({
      ...prev,
      minPrice: minPrice && minPrice > 0 ? minPrice : undefined,
      maxPrice: maxPrice && maxPrice > 0 ? maxPrice : undefined,
    }));
  }, [minPriceInput, maxPriceInput]);

  const handleRatingToggle = useCallback((rating: number) => {
    setFilters((prev) => {
      if (prev.minRating === rating) {
        // Deselect
        const { minRating: _, ...rest } = prev;
        return rest;
      } else {
        // Select
        return {
          ...prev,
          minRating: rating,
        };
      }
    });
  }, []);

  const handleProvinceSelect = useCallback((provinceId: number) => {
    setFilters((prev) => {
      const provinceCode = provinceId.toString();
      if (prev.provinceCode === provinceCode) {
        // Deselect
        const { provinceCode: _, ...rest } = prev;
        return rest;
      } else {
        // Select
        return {
          ...prev,
          provinceCode,
        };
      }
    });
    setProvinceMenuVisible(false);
  }, []);

  const handleSortSelect = useCallback((sortOption: string) => {
    setSelectedSort(sortOption);
    setSortMenuVisible(false);

    if (sortOption === 'default') {
      setFilters((prev) => {
        const { sortBy: _, sortDir: __, ...rest } = prev;
        return rest;
      });
    } else if (sortOption === 'name-asc') {
      setFilters((prev) => ({
        ...prev,
        sortBy: 'name',
        sortDir: 'asc',
      }));
    } else if (sortOption === 'name-desc') {
      setFilters((prev) => ({
        ...prev,
        sortBy: 'name',
        sortDir: 'desc',
      }));
    } else if (sortOption === 'price-asc') {
      setFilters((prev) => ({
        ...prev,
        sortBy: 'price',
        sortDir: 'asc',
      }));
    } else if (sortOption === 'price-desc') {
      setFilters((prev) => ({
        ...prev,
        sortBy: 'price',
        sortDir: 'desc',
      }));
    }
  }, []);

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      keyword: searchKeyword.trim() || undefined,
    }));
  }, [searchKeyword]);

  const handleResetFilters = useCallback(() => {
    setFilters({
      status: DEFAULT_STATUS,
    });
    setSearchKeyword('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setPriceError(null);
    setSelectedSort('default');
  }, []);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categoryId || filters.categoryName) count++;
    if (filters.minPrice || filters.maxPrice) count++;
    if (filters.minRating) count++;
    if (filters.provinceCode) count++;
    if (filters.keyword) count++;
    if (filters.sortBy) count++;
    return count;
  }, [filters]);

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
          priceRange: null,
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

  const selectedProvince = provinces.find((p) => p.ProvinceID.toString() === filters.provinceCode);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tất cả sản phẩm</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Tìm kiếm sản phẩm..."
          onChangeText={setSearchKeyword}
          value={searchKeyword}
          onSubmitEditing={handleSearch}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setIsFilterPanelOpen(true)}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={20}
            color={activeFiltersCount > 0 ? '#FFFFFF' : ORANGE}
          />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Panel Modal */}
      <Portal>
        <Modal
          visible={isFilterPanelOpen}
          onDismiss={() => setIsFilterPanelOpen(false)}
        >
          <View style={styles.filterModalContent}>
            <ScrollView style={styles.filterScrollView} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.filterHeader}>
                <Text style={styles.filterHeaderTitle}>Bộ lọc</Text>
                <TouchableOpacity onPress={() => setIsFilterPanelOpen(false)}>
                  <MaterialCommunityIcons name="close" size={24} color="#272727" />
                </TouchableOpacity>
              </View>

              {/* Categories */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Danh mục</Text>
                {isLoadingCategories ? (
                  <ActivityIndicator size="small" color={ORANGE} />
                ) : (
                  <View style={styles.categoryGrid}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.categoryId}
                        style={[
                          styles.categoryChip,
                          filters.categoryId === category.categoryId && styles.categoryChipActive,
                        ]}
                        onPress={() => handleCategoryToggle(category.categoryId, category.name)}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            filters.categoryId === category.categoryId && styles.categoryChipTextActive,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Sort */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Sắp xếp</Text>
                <Menu
                  visible={sortMenuVisible}
                  onDismiss={() => setSortMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      style={styles.sortButton}
                      onPress={() => setSortMenuVisible(true)}
                    >
                      <Text style={styles.sortButtonText}>
                        {selectedSort === 'default'
                          ? 'Mặc định'
                          : selectedSort === 'name-asc'
                            ? 'Tên A-Z'
                            : selectedSort === 'name-desc'
                              ? 'Tên Z-A'
                              : selectedSort === 'price-asc'
                                ? 'Giá tăng dần'
                                : selectedSort === 'price-desc'
                                  ? 'Giá giảm dần'
                                  : 'Mặc định'}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                  }
                >
                  <Menu.Item onPress={() => handleSortSelect('default')} title="Mặc định" />
                  <Menu.Item onPress={() => handleSortSelect('name-asc')} title="Tên A-Z" />
                  <Menu.Item onPress={() => handleSortSelect('name-desc')} title="Tên Z-A" />
                  <Menu.Item onPress={() => handleSortSelect('price-asc')} title="Giá tăng dần" />
                  <Menu.Item onPress={() => handleSortSelect('price-desc')} title="Giá giảm dần" />
                </Menu>
              </View>

              {/* Price Range */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Khoảng giá</Text>
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceInputLabel}>Từ</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0"
                      value={minPriceInput}
                      onChangeText={(text) => {
                        const formatted = formatNumber(text);
                        setMinPriceInput(formatted);
                        setPriceError(null);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceInputLabel}>Đến</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0"
                      value={maxPriceInput}
                      onChangeText={(text) => {
                        const formatted = formatNumber(text);
                        setMaxPriceInput(formatted);
                        setPriceError(null);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                {priceError && <Text style={styles.priceError}>{priceError}</Text>}
                <Button
                  mode="contained"
                  onPress={handlePriceRangeApply}
                  style={styles.applyPriceButton}
                  labelStyle={styles.applyPriceButtonLabel}
                >
                  ÁP DỤNG
                </Button>
              </View>

              {/* Rating */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Đánh giá tối thiểu</Text>
                <View style={styles.ratingContainer}>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <TouchableOpacity
                      key={rating}
                      style={styles.ratingStar}
                      onPress={() => handleRatingToggle(rating)}
                    >
                      <MaterialCommunityIcons
                        name="star"
                        size={28}
                        color={filters.minRating && filters.minRating >= rating ? '#FFB800' : '#DDD'}
                      />
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.ratingText}>Trở lên</Text>
                </View>
                {filters.minRating && (
                  <Text style={styles.ratingHint}>Đang lọc từ {filters.minRating} sao trở lên</Text>
                )}
              </View>

              {/* Province */}
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Tỉnh/Thành phố</Text>
                <Menu
                  visible={provinceMenuVisible}
                  onDismiss={() => setProvinceMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      style={styles.provinceButton}
                      onPress={() => setProvinceMenuVisible(true)}
                    >
                      <Text style={styles.provinceButtonText}>
                        {selectedProvince ? selectedProvince.ProvinceName : 'Chọn tỉnh/thành phố'}
                      </Text>
                      <MaterialCommunityIcons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                  }
                >
                  {isLoadingProvinces ? (
                    <View style={styles.provinceMenuLoading}>
                      <ActivityIndicator size="small" color={ORANGE} />
                    </View>
                  ) : (
                    provinces.map((province) => (
                      <Menu.Item
                        key={province.ProvinceID}
                        onPress={() => handleProvinceSelect(province.ProvinceID)}
                        title={province.ProvinceName}
                      />
                    ))
                  )}
                </Menu>
              </View>

              {/* Reset Button */}
              <View style={styles.filterActions}>
                <Button
                  mode="outlined"
                  onPress={handleResetFilters}
                  style={styles.resetButton}
                  labelStyle={styles.resetButtonLabel}
                >
                  Đặt lại
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setIsFilterPanelOpen(false)}
                  style={styles.applyButton}
                  labelStyle={styles.applyButtonLabel}
                >
                  Áp dụng
                </Button>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </Portal>

      {/* Products List */}
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
          <Text style={styles.emptyTitle}>Không tìm thấy sản phẩm</Text>
          {activeFiltersCount > 0 && (
            <Button
              mode="outlined"
              onPress={handleResetFilters}
              style={styles.clearFiltersButton}
            >
              Xóa bộ lọc
            </Button>
          )}
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

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchBar: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#F7F7F7',
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: ORANGE,
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#D32F2F',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  filterScrollView: {
    maxHeight: '100%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#272727',
  },
  filterSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#272727',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F7F7F7',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipActive: {
    backgroundColor: '#FFF3EB',
    borderColor: ORANGE,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextActive: {
    color: ORANGE,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#272727',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  priceInputContainer: {
    flex: 1,
    marginRight: 8,
  },
  priceInputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceInput: {
    padding: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 14,
    color: '#272727',
  },
  priceError: {
    fontSize: 12,
    color: '#D32F2F',
    marginTop: 4,
  },
  applyPriceButton: {
    marginTop: 8,
    backgroundColor: ORANGE,
  },
  applyPriceButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingStar: {
    marginRight: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  ratingHint: {
    fontSize: 12,
    color: ORANGE,
    marginTop: 8,
    fontStyle: 'italic',
  },
  provinceContainer: {
    position: 'relative',
  },
  provinceButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  provinceButtonText: {
    fontSize: 14,
    color: '#272727',
  },
  provinceMenuLoading: {
    padding: 16,
    alignItems: 'center',
  },
  filterActions: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  resetButton: {
    flex: 1,
    marginRight: 8,
    borderColor: ORANGE,
  },
  resetButtonLabel: {
    color: ORANGE,
  },
  applyButton: {
    flex: 1,
    backgroundColor: ORANGE,
  },
  applyButtonLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    marginBottom: 16,
  },
  clearFiltersButton: {
    borderColor: ORANGE,
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
