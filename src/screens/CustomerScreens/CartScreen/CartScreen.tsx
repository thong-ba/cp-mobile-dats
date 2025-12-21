import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { Button } from 'react-native-paper';
import { CartItemList } from '../../../components/CustomerScreenComponents/CartComponents';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteCartItems,
  getCustomerCart,
  updateQuantityWithVouchers,
} from '../../../services/cartService';
import { getProductById, getProductVouchers } from '../../../services/productService';
import { Cart, CartItem } from '../../../types/cart';
import { ProductDetail } from '../../../types/product';

const ORANGE = '#FF6A00';

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

// Throttle logging to once per 30 seconds per key
const lastLogTimeRef: Record<string, number> = {};
const THROTTLE_INTERVAL_MS = 30000; // 30 seconds

const throttledLog = (key: string, logFn: () => void) => {
  const now = Date.now();
  const lastLogTime = lastLogTimeRef[key] || 0;
  
  if (now - lastLogTime >= THROTTLE_INTERVAL_MS) {
    logFn();
    lastLogTimeRef[key] = now;
  }
};

// Extended ShopVoucher type for API response
type ShopVoucherFromAPI = {
  shopVoucherId?: string;
  voucherId?: string;
  code: string;
  title?: string;
  name?: string;
  description?: string;
  type?: 'PERCENT' | 'FIXED';
  discountPercent?: number | null;
  discountValue?: number | null;
  maxDiscountValue?: number | null;
  minOrderValue?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
  scopeType?: 'PRODUCT' | 'ALL_SHOP_VOUCHER' | string;
  scope?: 'PRODUCT' | 'ALL_SHOP_VOUCHER' | string;
  [key: string]: unknown;
};

type StoreGroup = {
  storeId: string;
  storeName: string;
  items: CartItem[];
};

type SelectedVoucher = {
  shopVoucherId: string;
  code: string;
};

const CartScreen: React.FC = () => {
  const navigation = useNavigation();
  const { authState, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Selection state: null = all selected (default), Set<string> = explicit selection
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  
  // Product cache để lấy storeId/storeName
  const [productCache, setProductCache] = useState<Map<string, ProductDetail>>(new Map());
  
  // Shop vouchers theo storeId (ALL_SHOP_VOUCHER scope)
  const [storeVouchers, setStoreVouchers] = useState<Map<string, ShopVoucherFromAPI[]>>(new Map());
  
  // Selected shop vouchers: Map<storeId, { shopVoucherId, code }>
  const [selectedShopVouchers, setSelectedShopVouchers] = useState<Map<string, SelectedVoucher>>(
    new Map(),
  );
  
  // Product vouchers theo cartItemId (PRODUCT_VOUCHER scope)
  const [productVouchers, setProductVouchers] = useState<Map<string, ShopVoucherFromAPI[]>>(
    new Map(),
  );
  
  // Selected product vouchers: Map<cartItemId, { shopVoucherId, code }>
  const [selectedProductVouchers, setSelectedProductVouchers] = useState<
    Map<string, SelectedVoucher>
  >(new Map());
  
  // Cache refs để tránh re-fetch
  const shopVouchersCacheByStoreIdRef = useRef<Map<string, ShopVoucherFromAPI[]>>(new Map());
  const productVouchersCacheByProductIdRef = useRef<Map<string, ShopVoucherFromAPI[]>>(new Map());

  // Check authentication when screen is focused
  useEffect(() => {
    if (!isAuthenticated) {
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        // @ts-ignore - navigate to Profile tab
        tabNavigator.navigate('Profile');
      }
    }
  }, [isAuthenticated, navigation]);

  const loadCart = useCallback(
    async (isPullRefresh = false) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;

      if (!customerId || !accessToken) {
        return;
      }

      try {
        if (isPullRefresh) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setErrorMessage(null);
        const data = await getCustomerCart({ customerId, accessToken });
        setCart(data);
      } catch (error: any) {
        console.error('[CartScreen] loadCart failed', error);
        const message =
          error?.response?.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : error?.response?.status === 404
            ? 'Giỏ hàng trống'
            : error?.message?.includes('Network')
            ? 'Không có kết nối mạng. Vui lòng thử lại.'
            : 'Không thể tải giỏ hàng. Vui lòng thử lại.';
        setErrorMessage(message);
      } finally {
        if (isPullRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [authState.accessToken, authState.decodedToken?.customerId],
  );

  // Fetch product details để lấy storeId/storeName
  useEffect(() => {
    const ensureProductDetails = async () => {
      if (!cart?.items || cart.items.length === 0) return;

      const items = cart.items;
      const missingProductIds = items
        .filter((item) => item.type === 'PRODUCT')
        .map((item) => item.refId)
        .filter((productId) => productId && !productCache.has(productId));

      if (missingProductIds.length === 0) return;

      try {
        const productDetails = await Promise.all(
          missingProductIds.map(async (productId) => {
            try {
              const product = await getProductById(productId);
              return product;
            } catch (error) {
              console.error(`[CartScreen] Failed to fetch product ${productId}:`, error);
              return null;
            }
          }),
        );

        setProductCache((prev) => {
          const next = new Map(prev);
          productDetails.forEach((product) => {
            if (product) {
              next.set(product.productId, product);
            }
          });
          return next;
        });
      } catch (error) {
        console.error('[CartScreen] ensureProductDetails failed', error);
      }
    };

    void ensureProductDetails();
  }, [cart?.items, productCache]);

  // Fetch shop vouchers (ALL_SHOP_VOUCHER scope) theo store
  useEffect(() => {
    const loadStoreVouchers = async () => {
      if (!cart?.items || cart.items.length === 0 || productCache.size === 0) return;

      const items = cart.items;
      const storeIds = new Set<string>();
      const storeProductMap = new Map<string, string>();

      items.forEach((item) => {
        if (item.type === 'PRODUCT') {
          const product = productCache.get(item.refId);
          if (product?.storeId) {
            storeIds.add(product.storeId);
            if (!storeProductMap.has(product.storeId)) {
              storeProductMap.set(product.storeId, item.refId);
            }
          }
        }
      });

      if (storeIds.size === 0) return;

      // Chỉ load stores chưa có trong cache
      const storesToLoad = Array.from(storeProductMap.entries()).filter(
        ([storeId]) => !shopVouchersCacheByStoreIdRef.current.has(storeId),
      );

      if (storesToLoad.length === 0) {
        // Update từ cache
        setStoreVouchers((prev) => {
          const next = new Map(prev);
          Array.from(storeIds).forEach((storeId) => {
            const cachedVouchers = shopVouchersCacheByStoreIdRef.current.get(storeId);
            if (cachedVouchers && cachedVouchers.length > 0) {
              next.set(storeId, cachedVouchers);
            }
          });
          return next;
        });
        return;
      }

      // Gọi API cho từng store
      const voucherPromises = storesToLoad.map(async ([storeId, productId]) => {
        try {
      const voucherRes = await getProductVouchers(productId);
      // API trả về vouchers.shopVouchers (theo response mẫu)
      const shopVouchersList = (voucherRes.vouchers?.shopVouchers as ShopVoucherFromAPI[]) || [];

      console.log(`[CartScreen] Loaded shop vouchers for store ${storeId}`, {
        productId,
        shopVouchersCount: shopVouchersList.length,
        shopVouchers: shopVouchersList.map((v) => ({
          shopVoucherId: v.shopVoucherId || v.voucherId,
          code: v.code,
          title: v.title,
          scopeType: v.scopeType,
          discountPercent: v.discountPercent,
          discountValue: v.discountValue,
          maxDiscountValue: v.maxDiscountValue,
          minOrderValue: v.minOrderValue,
        })),
      });

      // Lọc ra vouchers có scopeType: "ALL_SHOP_VOUCHER" hoặc scope: "ALL_SHOP_VOUCHER"
      const allShopVouchers = shopVouchersList.filter(
        (v) =>
          v.scopeType === 'ALL_SHOP_VOUCHER' ||
          v.scope === 'ALL_SHOP_VOUCHER' ||
          (!v.scopeType && !v.scope), // Fallback: nếu không có scope, coi như ALL_SHOP_VOUCHER
      );

      console.log(`[CartScreen] Filtered ALL_SHOP_VOUCHER vouchers for store ${storeId}`, {
        allShopVouchersCount: allShopVouchers.length,
        allShopVouchers: allShopVouchers.map((v) => ({
          shopVoucherId: v.shopVoucherId || v.voucherId,
          code: v.code,
          title: v.title,
        })),
      });

          return { storeId, vouchers: allShopVouchers };
        } catch (error) {
          console.error(`[CartScreen] Failed to load vouchers for store ${storeId}:`, error);
          return { storeId, vouchers: [] };
        }
      });

      const results = await Promise.all(voucherPromises);

      // Update cache (ref)
      results.forEach(({ storeId, vouchers }) => {
        shopVouchersCacheByStoreIdRef.current.set(storeId, vouchers);
      });

      // Update state
      setStoreVouchers((prev) => {
        const next = new Map(prev);
        Array.from(storeIds).forEach((storeId) => {
          const cachedVouchers =
            results.find((r) => r.storeId === storeId)?.vouchers ||
            shopVouchersCacheByStoreIdRef.current.get(storeId);
          if (cachedVouchers && cachedVouchers.length > 0) {
            next.set(storeId, cachedVouchers);
            console.log(`[CartScreen] Updated store vouchers for ${storeId}`, {
              vouchersCount: cachedVouchers.length,
              vouchers: cachedVouchers.map((v) => ({
                shopVoucherId: v.shopVoucherId || v.voucherId,
                code: v.code,
                title: v.title,
                discountPercent: v.discountPercent,
                discountValue: v.discountValue,
                maxDiscountValue: v.maxDiscountValue,
                minOrderValue: v.minOrderValue,
              })),
            });
          }
        });
        return next;
      });
    };

    void loadStoreVouchers();
  }, [cart?.items, productCache]);

  // Fetch product vouchers (PRODUCT_VOUCHER scope) theo item
  useEffect(() => {
    const loadProductVouchers = async () => {
      if (!cart?.items || cart.items.length === 0) return;

      const items = cart.items;
      const productItems = items.filter((item) => item.type === 'PRODUCT');

      if (productItems.length === 0) {
        setProductVouchers(new Map());
        return;
      }

      // Chỉ load items chưa có trong cache
      const itemsToLoad = productItems.filter((item) => {
        return !productVouchersCacheByProductIdRef.current.has(item.refId);
      });

      if (itemsToLoad.length === 0) {
        // Update từ cache
        setProductVouchers((prev) => {
          const next = new Map(prev);
          productItems.forEach((item) => {
            const cachedVouchers = productVouchersCacheByProductIdRef.current.get(item.refId);
            if (cachedVouchers) {
              next.set(item.cartItemId, cachedVouchers);
            } else {
              next.delete(item.cartItemId);
            }
          });
          return next;
        });
        return;
      }

      // Gọi API cho từng product
      const voucherPromises = itemsToLoad.map(async (item) => {
        try {
          const voucherRes = await getProductVouchers(item.refId);
          const shopVouchersList = (voucherRes.vouchers?.shopVouchers as ShopVoucherFromAPI[]) || [];

          // Lọc ra vouchers có scopeType: "PRODUCT_VOUCHER" hoặc scope: "PRODUCT"
          const productVouchersList = shopVouchersList.filter(
            (v) => v.scopeType === 'PRODUCT_VOUCHER' || v.scope === 'PRODUCT',
          );

          return { productId: item.refId, vouchers: productVouchersList };
        } catch (error) {
          console.error(`[CartScreen] Failed to load product vouchers:`, error);
          return { productId: item.refId, vouchers: [] };
        }
      });

      const results = await Promise.all(voucherPromises);

      // Update cache (ref)
      results.forEach(({ productId, vouchers }) => {
        productVouchersCacheByProductIdRef.current.set(productId, vouchers);
      });

      // Update state (map từ productId sang cartItemId)
      setProductVouchers((prev) => {
        const next = new Map(prev);
        productItems.forEach((item) => {
          const cachedVouchers =
            results.find((r) => r.productId === item.refId)?.vouchers ||
            productVouchersCacheByProductIdRef.current.get(item.refId);
          if (cachedVouchers && cachedVouchers.length > 0) {
            next.set(item.cartItemId, cachedVouchers);
          } else {
            next.delete(item.cartItemId);
          }
        });
        return next;
      });
    };

    void loadProductVouchers();
  }, [cart?.items]);

  // Store grouping
  const storeGroups = useMemo(() => {
    if (!cart?.items || cart.items.length === 0) return [];

    const groups = new Map<string, StoreGroup>();

    cart.items.forEach((item) => {
      let storeId = `unknown-${item.refId}`;
      let storeName = 'Cửa hàng';

      if (item.type === 'PRODUCT') {
        const product = productCache.get(item.refId);
        if (product?.storeId) {
          storeId = product.storeId;
        }
        if (product?.storeName) {
          storeName = product.storeName;
        }
      }

      if (!groups.has(storeId)) {
        groups.set(storeId, { storeId, storeName, items: [] });
      }
      groups.get(storeId)!.items.push(item);
    });

    return Array.from(groups.values());
  }, [cart?.items, productCache]);

  const handleUpdateQuantity = useCallback(
    async (cartItemId: string, quantity: number) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) return;
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const updatedCart = await updateQuantityWithVouchers({
          customerId,
          accessToken,
          payload: {
            cartItemId,
            quantity: Math.max(1, Math.min(quantity, 99)),
            storeVouchers: null,
            platformVouchers: null,
            serviceTypeIds: null,
          },
        });

        if (!updatedCart || !Array.isArray(updatedCart.items)) {
          await loadCart(true);
          return;
        }

        setCart(updatedCart);
      } catch (error: any) {
        console.error('[CartScreen] update quantity failed', error);
        const message =
          error?.response?.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : error?.response?.data?.message || 'Không thể cập nhật số lượng. Vui lòng thử lại.';
        setErrorMessage(message);
        await loadCart(true);
      } finally {
        setIsLoading(false);
      }
    },
    [authState.accessToken, authState.decodedToken?.customerId, loadCart],
  );

  const handleRemoveItem = useCallback(
    async (cartItemId: string) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) return;
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const updatedCart = await deleteCartItems({
          customerId,
          accessToken,
          cartItemIds: [cartItemId],
        });
        setCart(updatedCart);
        if (selectedIds) {
          const newSelected = new Set(selectedIds);
          newSelected.delete(cartItemId);
          setSelectedIds(newSelected.size > 0 ? newSelected : null);
        }
        // Clean up product voucher selection
        setSelectedProductVouchers((prev) => {
          const next = new Map(prev);
          next.delete(cartItemId);
          return next;
        });
      } catch (error: any) {
        console.error('[CartScreen] delete item failed', error);
        const message =
          error?.response?.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
            : error?.response?.data?.message || 'Không thể xóa sản phẩm. Vui lòng thử lại.';
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    },
    [authState.accessToken, authState.decodedToken?.customerId, selectedIds],
  );

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadCart();
      }
    }, [loadCart, isAuthenticated]),
  );

  // Poll cart every 30s when authenticated (tăng từ 10s lên 30s để giảm request)
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    const id = setInterval(() => {
      if (!isLoading) {
        loadCart(true);
      }
    }, 30000); // Tăng từ 10s lên 30s
    return () => clearInterval(id);
  }, [isAuthenticated, isLoading, loadCart]);

  // Clean up selectedIds when cart items change
  useEffect(() => {
    if (selectedIds && cart?.items) {
      const currentItemIds = new Set(cart.items.map((item) => item.cartItemId));
      const filtered = new Set(
        Array.from(selectedIds).filter((id) => currentItemIds.has(id)),
      );
      if (filtered.size !== selectedIds.size) {
        setSelectedIds(filtered.size > 0 ? filtered : null);
      }
    }
  }, [cart?.items, selectedIds]);

  // Computed: Selected items
  const selectedItems = useMemo(() => {
    if (!cart?.items) return [];
    return selectedIds === null
      ? cart.items
      : cart.items.filter((item) => selectedIds.has(item.cartItemId));
  }, [cart?.items, selectedIds]);

  // Helper: Kiểm tra voucher có active không (dựa trên startTime, endTime, status)
  const isVoucherActive = useCallback((voucher: ShopVoucherFromAPI): boolean => {
    const now = new Date();
    
    // Kiểm tra status - chỉ reject nếu status rõ ràng là INACTIVE hoặc EXPIRED
    // Nếu status là null/undefined, coi như ACTIVE (backend có thể không gửi status)
    if (voucher.status) {
      // Chỉ reject nếu status rõ ràng không phải ACTIVE
      if (voucher.status === 'INACTIVE' || voucher.status === 'EXPIRED' || voucher.status === 'USED') {
        return false;
      }
      // Nếu status là ACTIVE hoặc không có trong danh sách reject, tiếp tục kiểm tra
    }
    
    // Kiểm tra thời gian - chỉ kiểm tra nếu có giá trị
    if (voucher.startTime) {
      try {
        const startTime = new Date(voucher.startTime);
        if (!isNaN(startTime.getTime()) && now < startTime) {
          return false; // Chưa đến thời gian bắt đầu
        }
      } catch (error) {
        // Invalid date format, skip check
        console.warn('[CartScreen] Invalid startTime format', voucher.startTime);
      }
    }
    
    if (voucher.endTime) {
      try {
        const endTime = new Date(voucher.endTime);
        if (!isNaN(endTime.getTime()) && now > endTime) {
          return false; // Đã hết hạn
        }
      } catch (error) {
        // Invalid date format, skip check
        console.warn('[CartScreen] Invalid endTime format', voucher.endTime);
      }
    }
    
    return true;
  }, []);

  // Computed: Price calculations với vouchers
  const priceCalculations = useMemo(() => {
    if (!selectedItems.length) {
      return {
        baseSubtotal: 0,
        currentSubtotal: 0,
        platformDiscountTotal: 0,
        shopVoucherDiscount: 0,
        productVoucherDiscount: 0,
        otherStoreDiscount: 0,
        total: 0,
      };
    }

    // Sử dụng giá trị từ API thay vì tính lại
    // API trả về: subtotal (tổng lineTotal), discountTotal (tổng giảm), grandTotal
    // Tính baseSubtotal từ baseUnitPrice để hiển thị "Giá gốc"
    const baseSubtotal = selectedItems.reduce((sum, item) => {
      const base = item.baseUnitPrice ?? item.unitPrice;
      return sum + base * item.quantity;
    }, 0);

    // Current subtotal: sử dụng từ cart.subtotal (tổng lineTotal từ API)
    // Hoặc tính từ lineTotal của từng item nếu cần
    const currentSubtotal = cart?.subtotal ?? selectedItems.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );

    // Platform discount = chênh lệch giữa giá gốc và giá sau campaign
    const platformDiscountTotal = Math.max(0, baseSubtotal - currentSubtotal);

    // Shop voucher discount (ALL_SHOP_VOUCHER scope)
    let shopVoucherDiscount = 0;
    selectedShopVouchers.forEach((voucherInfo, storeId) => {
      const vouchers = storeVouchers.get(storeId) || [];
      const voucher = vouchers.find(
        (v: ShopVoucherFromAPI) => (v.shopVoucherId || v.voucherId) === voucherInfo.shopVoucherId,
      );
      if (!voucher) {
        console.warn('[CartScreen] Shop voucher not found', {
          storeId,
          shopVoucherId: voucherInfo.shopVoucherId,
          availableVouchers: vouchers.map((v) => v.shopVoucherId || v.voucherId),
        });
        return;
      }

      // Kiểm tra voucher có active không
      if (!isVoucherActive(voucher)) {
        console.warn('[CartScreen] Shop voucher not active', {
          storeId,
          shopVoucherId: voucherInfo.shopVoucherId,
          status: voucher.status,
          startTime: voucher.startTime,
          endTime: voucher.endTime,
        });
        return;
      }

      // Tính subtotal của store này (chỉ items được chọn)
      // Sử dụng unitPrice (giá sau platform campaign) để tính shop voucher discount
      const storeItems = selectedItems.filter((item) => {
        if (item.type !== 'PRODUCT') return false;
        const product = productCache.get(item.refId);
        return product?.storeId === storeId;
      });

      if (storeItems.length === 0) {
        console.warn('[CartScreen] No items found for store', { storeId });
        return;
      }

      // Tính storeSubtotal: sử dụng unitPrice (giá sau platform campaign)
      // Đây là giá đã được backend tính sẵn với platform campaign
      const storeSubtotal = storeItems.reduce(
        (sum, item) => {
          const itemTotal = item.unitPrice * item.quantity;
          return sum + itemTotal;
        },
        0,
      );

      throttledLog('shop_voucher_calculation', () => {
        console.log('[CartScreen] Shop voucher calculation', {
          storeId,
          storeItemsCount: storeItems.length,
          storeSubtotal,
          voucher: {
            shopVoucherId: voucher.shopVoucherId || voucher.voucherId,
            code: voucher.code,
            type: voucher.type,
            discountPercent: voucher.discountPercent,
            discountValue: voucher.discountValue,
            maxDiscountValue: voucher.maxDiscountValue,
            minOrderValue: voucher.minOrderValue,
          },
        });
      });

      // Kiểm tra minOrderValue
      if (voucher.minOrderValue && storeSubtotal < voucher.minOrderValue) {
        console.warn('[CartScreen] Store subtotal below minOrderValue', {
          storeId,
          storeSubtotal,
          minOrderValue: voucher.minOrderValue,
        });
        return; // Không đủ điều kiện minOrderValue
      }

      // Tính discount
      // Logic: Nếu có discountPercent → PERCENT, nếu có discountValue → FIXED
      // API response không có field 'type', chỉ có discountPercent và discountValue
      if (voucher.discountPercent !== null && voucher.discountPercent !== undefined && voucher.discountPercent > 0) {
        // Tính số tiền giảm theo phần trăm
        const discount = (storeSubtotal * voucher.discountPercent) / 100;
        // Áp dụng maxDiscountValue nếu có
        const finalDiscount = voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
          ? Math.min(discount, voucher.maxDiscountValue)
          : discount;
        shopVoucherDiscount += Math.round(finalDiscount); // Round để tránh số thập phân
        throttledLog('shop_voucher_percent_calculated', () => {
          console.log('[CartScreen] Shop voucher PERCENT discount calculated', {
            storeId,
            storeSubtotal,
            discountPercent: voucher.discountPercent,
            discount,
            maxDiscountValue: voucher.maxDiscountValue,
            finalDiscount,
            shopVoucherDiscount,
          });
        });
      } else if (voucher.discountValue !== null && voucher.discountValue !== undefined && voucher.discountValue > 0) {
        // Giảm giá cố định
        shopVoucherDiscount += Math.round(voucher.discountValue);
        throttledLog('shop_voucher_fixed_applied', () => {
          console.log('[CartScreen] Shop voucher FIXED discount applied', {
            storeId,
            discountValue: voucher.discountValue,
            shopVoucherDiscount,
          });
        });
      } else {
        console.warn('[CartScreen] Shop voucher missing discount values', {
          storeId,
          shopVoucherId: voucher.shopVoucherId || voucher.voucherId,
          code: voucher.code,
          discountPercent: voucher.discountPercent,
          discountValue: voucher.discountValue,
        });
      }
    });

    // Product voucher discount (PRODUCT_VOUCHER scope)
    let productVoucherDiscount = 0;
    selectedProductVouchers.forEach((voucherInfo, cartItemId) => {
      const vouchers = productVouchers.get(cartItemId) || [];
      const voucher = vouchers.find(
        (v: ShopVoucherFromAPI) => (v.shopVoucherId || v.voucherId) === voucherInfo.shopVoucherId,
      );
      if (!voucher) return;

      // Kiểm tra voucher có active không
      if (!isVoucherActive(voucher)) {
        return;
      }

      const item = selectedItems.find((it) => it.cartItemId === cartItemId);
      if (!item) return;

      // Tính subtotal của item này
      // Quan trọng: Nếu có platform campaign, dùng platformCampaignPrice
      // Ngược lại, dùng baseUnitPrice hoặc unitPrice
      const priceForVoucherCalculation =
        item.inPlatformCampaign &&
        !item.campaignUsageExceeded &&
        item.platformCampaignPrice !== undefined &&
        item.platformCampaignPrice !== null
          ? item.platformCampaignPrice // Giá sau platform campaign
          : item.baseUnitPrice ?? item.unitPrice; // Giá gốc hoặc giá hiện tại

      const itemSubtotal = priceForVoucherCalculation * item.quantity;

      // Kiểm tra minOrderValue
      if (voucher.minOrderValue && itemSubtotal < voucher.minOrderValue) {
        return; // Không đủ điều kiện minOrderValue
      }

      // Tính discount
      // Logic: Nếu có discountPercent → PERCENT, nếu có discountValue → FIXED
      // API response không có field 'type', chỉ có discountPercent và discountValue
      if (voucher.discountPercent !== null && voucher.discountPercent !== undefined && voucher.discountPercent > 0) {
        // Tính số tiền giảm theo phần trăm
        const discount = (itemSubtotal * voucher.discountPercent) / 100;
        // Áp dụng maxDiscountValue nếu có
        productVoucherDiscount += voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
          ? Math.min(discount, voucher.maxDiscountValue)
          : discount;
      } else if (voucher.discountValue !== null && voucher.discountValue !== undefined && voucher.discountValue > 0) {
        // Giảm giá cố định
        productVoucherDiscount += voucher.discountValue;
      }
    });

    // Other store discount: từ cart.discountTotal (backend đã tính sẵn)
    // Logic theo tài liệu và UI web:
    // - Nếu user đã chọn shop voucher ở frontend → shopVoucherDiscount được tính từ frontend
    // - Nếu user chưa chọn shop voucher nhưng backend đã tính (cart.discountTotal > 0)
    //   → Có thể backend tự động áp dụng shop voucher, hiển thị như "Giảm giá voucher cửa hàng"
    // - Nếu user đã chọn shop voucher và cart.discountTotal > shopVoucherDiscount + productVoucherDiscount
    //   → Phần còn lại là "Giảm giá cửa hàng" khác
    let otherStoreDiscount = 0;
    if (cart && cart.discountTotal > 0) {
      const calculatedVoucherDiscount = shopVoucherDiscount + productVoucherDiscount;
      if (calculatedVoucherDiscount === 0) {
        // User chưa chọn voucher ở frontend, backend đã tính discount
        // Có thể là shop voucher được backend tự động áp dụng
        otherStoreDiscount = cart.discountTotal;
      } else if (cart.discountTotal > calculatedVoucherDiscount) {
        // User đã chọn voucher ở frontend, nhưng backend có discount lớn hơn
        // Phần chênh lệch là "Giảm giá cửa hàng" khác
        otherStoreDiscount = cart.discountTotal - calculatedVoucherDiscount;
      }
      // Nếu cart.discountTotal <= calculatedVoucherDiscount, không có otherStoreDiscount
    }

    // Grand total = Current Subtotal - Shop Voucher Discount - Product Voucher Discount
    // Logic:
    // - Nếu user đã chọn shop voucher ở frontend → trừ shopVoucherDiscount
    // - Nếu user chưa chọn shop voucher nhưng backend đã tính → trừ otherStoreDiscount
    // - otherStoreDiscount chỉ được trừ khi user chưa chọn shop voucher (shopVoucherDiscount === 0)
    // - Ưu tiên sử dụng cart.grandTotal từ API nếu không có voucher được chọn ở frontend
    const totalDiscount = shopVoucherDiscount > 0 
      ? shopVoucherDiscount + productVoucherDiscount
      : otherStoreDiscount + productVoucherDiscount;
    
    // Nếu không có voucher được chọn ở frontend, sử dụng grandTotal từ API
    // Nếu có voucher được chọn, tính từ frontend
    const total = shopVoucherDiscount > 0 || productVoucherDiscount > 0
      ? Math.max(0, currentSubtotal - totalDiscount)
      : (cart?.grandTotal ?? Math.max(0, currentSubtotal - totalDiscount));

    // Debug log để kiểm tra tính toán (throttled to once per 30 seconds)
    throttledLog('price_calculations_summary', () => {
      console.log('[CartScreen] Price calculations summary', {
        baseSubtotal,
        currentSubtotal,
        platformDiscountTotal,
        shopVoucherDiscount,
        productVoucherDiscount,
        otherStoreDiscount,
        cartDiscountTotal: cart?.discountTotal,
        cartGrandTotal: cart?.grandTotal,
        total,
        selectedItemsCount: selectedItems.length,
        selectedShopVouchersCount: selectedShopVouchers.size,
        selectedProductVouchersCount: selectedProductVouchers.size,
        selectedShopVouchers: Array.from(selectedShopVouchers.entries()).map(([storeId, voucher]) => ({
          storeId,
          shopVoucherId: voucher.shopVoucherId,
          code: voucher.code,
        })),
      });
    });

    return {
      baseSubtotal,
      currentSubtotal,
      platformDiscountTotal,
      shopVoucherDiscount,
      productVoucherDiscount,
      otherStoreDiscount,
      total,
    };
  }, [
    selectedItems,
    selectedShopVouchers,
    storeVouchers,
    selectedProductVouchers,
    productVouchers,
    productCache,
    isVoucherActive,
    cart,
  ]);

  // Show login required message if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="lock-outline" size={80} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>Yêu cầu đăng nhập</Text>
          <Text style={styles.emptySubtitle}>
            Vui lòng đăng nhập để xem giỏ hàng của bạn
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => {
              const tabNavigator = navigation.getParent();
              if (tabNavigator) {
                // @ts-ignore - navigate to Profile tab
                tabNavigator.navigate('Profile');
              }
            }}
          >
            <Text style={styles.shopButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading && !cart) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.loaderText}>Đang tải giỏ hàng...</Text>
      </View>
    );
  }

  if (errorMessage && !cart) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#B3261E" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadCart()}>
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="cart-outline" size={80} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>Giỏ hàng trống</Text>
          <Text style={styles.emptySubtitle}>
            Hãy thêm sản phẩm vào giỏ hàng để tiếp tục mua sắm
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => {
              // @ts-ignore - navigate to Home
              navigation.navigate('Home');
            }}
          >
            <Text style={styles.shopButtonText}>Tiếp tục mua sắm</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const {
    baseSubtotal,
    currentSubtotal,
    platformDiscountTotal,
    shopVoucherDiscount,
    productVoucherDiscount,
    otherStoreDiscount,
    total,
  } = priceCalculations;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadCart(true)} />}
      >
        <CartItemList
          items={cart.items}
          storeGroups={storeGroups}
          storeVouchers={storeVouchers}
          productVouchers={productVouchers}
          selectedShopVouchers={selectedShopVouchers}
          selectedProductVouchers={selectedProductVouchers}
          onCartChange={loadCart}
          onRemoveItem={handleRemoveItem}
          onQuantityChange={handleUpdateQuantity}
          onSelectShopVoucher={(storeId, shopVoucherId, code) => {
            setSelectedShopVouchers((prev) => {
              const next = new Map(prev);
              if (shopVoucherId) {
                next.set(storeId, { shopVoucherId, code });
              } else {
                next.delete(storeId);
              }
              return next;
            });
          }}
          onSelectProductVoucher={(cartItemId, shopVoucherId, code) => {
            setSelectedProductVouchers((prev) => {
              const next = new Map(prev);
              if (shopVoucherId) {
                next.set(cartItemId, { shopVoucherId, code });
              } else {
                next.delete(cartItemId);
              }
              return next;
            });
          }}
        />
      </ScrollView>

      {/* Bottom Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Giá gốc:</Text>
          <Text style={styles.summaryValue}>
            {formatCurrencyVND(baseSubtotal > 0 ? baseSubtotal : (cart?.subtotal ?? 0))}
          </Text>
        </View>
        {platformDiscountTotal > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm nền tảng:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatCurrencyVND(platformDiscountTotal)}
            </Text>
          </View>
        )}
        {/* Hiển thị giảm giá voucher cửa hàng */}
        {/* Logic: Nếu user đã chọn shop voucher ở frontend → hiển thị shopVoucherDiscount */}
        {/* Nếu chưa chọn nhưng backend đã tính (cart.discountTotal) → hiển thị từ backend */}
        {shopVoucherDiscount > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm giá voucher cửa hàng:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatCurrencyVND(shopVoucherDiscount)}
            </Text>
          </View>
        ) : otherStoreDiscount > 100 && cart && cart.discountTotal > 0 && productVoucherDiscount === 0 ? (
          // Backend đã tính shop voucher discount nhưng user chưa chọn ở frontend
          // Hiển thị như "Giảm giá voucher cửa hàng" (từ backend)
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm giá voucher cửa hàng:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatCurrencyVND(otherStoreDiscount)}
            </Text>
          </View>
        ) : null}
        {/* Hiển thị giảm giá cửa hàng khác (nếu có, sau khi đã trừ shop voucher) */}
        {otherStoreDiscount > 100 && shopVoucherDiscount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm giá cửa hàng:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatCurrencyVND(otherStoreDiscount)}
            </Text>
          </View>
        )}
        {productVoucherDiscount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giảm product voucher:</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -{formatCurrencyVND(productVoucherDiscount)}
            </Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Tổng cộng:</Text>
          <Text style={styles.totalValue}>{formatCurrencyVND(total)}</Text>
        </View>
        <Button
          mode="contained"
          onPress={() => {
            // Prepare checkout payload với vouchers
            const selectedCartItemIds =
              selectedIds === null
                ? cart.items.map((item) => item.cartItemId)
                : Array.from(selectedIds);

            const storeVouchersPayload: Record<string, SelectedVoucher> = {};
            selectedShopVouchers.forEach((voucherInfo, storeId) => {
              storeVouchersPayload[storeId] = voucherInfo;
            });

            const productVouchersPayload: Record<string, SelectedVoucher> = {};
            selectedProductVouchers.forEach((voucherInfo, cartItemId) => {
              if (selectedCartItemIds.includes(cartItemId)) {
                productVouchersPayload[cartItemId] = voucherInfo;
              }
            });

            // @ts-ignore
            navigation.navigate('Checkout', {
              cart,
              selectedCartItemIds,
              storeVouchers: storeVouchersPayload,
              productVouchers: productVouchersPayload,
            });
          }}
          style={styles.checkoutButton}
          contentStyle={styles.checkoutButtonContent}
          labelStyle={styles.checkoutButtonLabel}
          disabled={selectedItems.length === 0}
        >
          Thanh toán {selectedItems.length > 0 ? `(${selectedItems.length})` : ''}
        </Button>
      </View>
    </View>
  );
};

export default CartScreen;

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
    backgroundColor: ORANGE,
    paddingTop: 50,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 30,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  loaderText: {
    marginTop: 12,
    color: '#555',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F7F7',
  },
  errorText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#B3261E',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  shopButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: ORANGE,
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  summaryBar: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '600',
  },
  discountValue: {
    color: '#4CAF50',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ORANGE,
  },
  checkoutButton: {
    backgroundColor: ORANGE,
    borderRadius: 12,
  },
  checkoutButtonContent: {
    paddingVertical: 8,
  },
  checkoutButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
