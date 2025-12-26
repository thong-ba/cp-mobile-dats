import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, RadioButton, Snackbar } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import { CustomerStackParamList } from '../../../navigation/CustomerStackNavigator';
import {
  checkoutCod,
  checkoutPreview,
  deleteCartItems,
  getCustomerCart,
} from '../../../services/cartService';
import { getCustomerAddresses } from '../../../services/customerService';
import { getProductById, getProductVouchers } from '../../../services/productService';
import {
  buildGHNItems,
  calculateGHNFee,
  calculateServiceType,
  calculateTotalWeightGrams,
  ProductCacheItem,
} from '../../../services/shippingService';
import { getStoreDefaultAddressByProduct } from '../../../services/storeService';
import { getShopVouchersByStore } from '../../../services/voucherService';
import { Cart } from '../../../types/cart';
import {
  CheckoutItemPayload,
  CheckoutPreviewRequest,
  CheckoutPreviewResponse,
} from '../../../types/checkout';
import { CustomerAddress } from '../../../types/customer';
import { PlatformCampaign, PlatformVoucherItem } from '../../../types/product';
import {
  AppliedStoreVoucher,
  AppliedStoreWideVoucher,
  PlatformVoucherDiscount,
  ShopVoucher,
} from '../../../types/voucher';

const AsyncStorage: any =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@react-native-async-storage/async-storage').default;

const CHECKOUT_SESSION_KEY = 'checkout:payload:v1';

const ORANGE = '#FF6A00';

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

// Disable all logging - replace console with no-op functions
const noop = (...args: any[]) => {};
const log = {
  log: noop,
  error: noop,
  warn: noop,
};

// Throttle logging to once per 30 seconds per key (disabled)
const throttledLog = (key: string, logFn: () => void) => {
  // Logging disabled - do nothing
};

const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<CustomerStackParamList, 'Checkout'>>();
  const { authState, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  // Chỉ sử dụng COD, không cần state cho payment method nữa
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  // Track if data has been loaded to prevent repeated loading
  const hasLoadedRef = useRef(false);
  // Track if vouchers have been loaded to prevent repeated loading
  const vouchersLoadedRef = useRef<string | null>(null); // Track cartId to know if vouchers were loaded for this cart
  // Track last log time for throttling (30s)
  const lastLogTimeRef = useRef<Record<string, number>>({});
  // Track last API call time to prevent frequent requests
  const lastPreviewCallRef = useRef<number>(0);
  const lastShippingCallRef = useRef<number>(0);
  const PREVIEW_THROTTLE_MS = 3000; // 3 seconds between preview calls
  const SHIPPING_THROTTLE_MS = 2000; // 2 seconds between shipping calls

  // Selected items và vouchers từ AsyncStorage (checkout session)
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<string[]>([]);
  const [selectedShopVouchers, setSelectedShopVouchers] = useState<
    Map<string, { shopVoucherId: string; code: string }>
  >(new Map());
  const [selectedProductVouchers, setSelectedProductVouchers] = useState<
    Map<string, { shopVoucherId: string; code: string }>
  >(new Map());

  // Voucher states (legacy - giữ lại để tương thích)
  const [availableVouchers, setAvailableVouchers] = useState<ShopVoucher[]>([]);
  const [appliedStoreVouchers, setAppliedStoreVouchers] = useState<
    Record<string, AppliedStoreVoucher>
  >({});
  const [storeWideVouchers, setStoreWideVouchers] = useState<Record<string, ShopVoucher[]>>({});
  const [appliedStoreWideVouchers, setAppliedStoreWideVouchers] = useState<
    Record<string, AppliedStoreWideVoucher>
  >({});
  const [platformVoucherDiscounts, setPlatformVoucherDiscounts] = useState<
    Record<string, PlatformVoucherDiscount>
  >({});

  // Shop vouchers và product vouchers (giống CartScreen)
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
    storeId?: string;
    [key: string]: unknown;
  };

  // Shop vouchers theo storeId (ALL_SHOP_VOUCHER scope)
  const [storeVouchers, setStoreVouchers] = useState<Map<string, ShopVoucherFromAPI[]>>(new Map());
  
  // Product vouchers theo cartItemId (PRODUCT_VOUCHER scope)
  const [productVouchers, setProductVouchers] = useState<Map<string, ShopVoucherFromAPI[]>>(new Map());
  
  // Store address cache để tránh gọi API nhiều lần
  const storeAddressCacheRef = useRef<Map<string, { districtCode: string; wardCode: string }>>(
    new Map(),
  );

  // Product cache & shipping
  const [productCache, setProductCache] = useState<Record<string, ProductCacheItem>>({});
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [storeShippingFees, setStoreShippingFees] = useState<Record<string, number>>({});
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [shippingFeeError, setShippingFeeError] = useState<string | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

  // Checkout preview data
  const [previewData, setPreviewData] = useState<CheckoutPreviewResponse['data'] | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Map cart items to UI items with pricing - filter by selectedCartItemIds
  // Ưu tiên sử dụng preview data nếu có để hiển thị giá chính xác
  const cartItems = useMemo(() => {
    if (!cart) return [];
    
    // Filter items by selectedCartItemIds (từ AsyncStorage hoặc route params)
    const itemIdsToUse = selectedCartItemIds.length > 0 
      ? selectedCartItemIds 
      : route.params?.selectedCartItemIds || [];
    
    const itemsToUse = itemIdsToUse.length > 0
      ? cart.items.filter((item) => itemIdsToUse.includes(item.cartItemId))
      : cart.items;
    
    return itemsToUse.map((item) => {
      // Nếu có preview data, tìm item tương ứng trong preview để lấy giá chính xác
      let originalPrice = item.baseUnitPrice ?? item.unitPrice;
      let finalPrice = item.unitPrice;
      
      if (previewData) {
        // Tìm item trong preview data theo cartItemId hoặc variantId
        for (const store of previewData.stores) {
          const previewItem = store.items.find(
            (pi) => pi.cartItemId === item.cartItemId || pi.variantId === item.variantId,
          );
          if (previewItem) {
            // Sử dụng giá từ preview data
            originalPrice = previewItem.unitPriceBeforeDiscount ?? originalPrice;
            finalPrice = previewItem.finalUnitPrice ?? previewItem.finalLineTotal ?? finalPrice;
            break;
          }
        }
      } else {
        // Fallback: tính toán từ cart item
        const hasPlatformPrice =
          item.platformCampaignPrice !== null && item.platformCampaignPrice !== undefined;
        finalPrice =
          item.inPlatformCampaign &&
          !item.campaignUsageExceeded &&
          hasPlatformPrice &&
          item.platformCampaignPrice
            ? item.platformCampaignPrice
            : item.unitPrice;
      }
      
      return {
        ...item,
        finalPrice,
        originalPrice,
        isSelected: true, // All items in checkout are selected
      };
    });
  }, [cart, previewData, selectedCartItemIds, route.params?.selectedCartItemIds]);

  // Load cart and addresses
  const loadData = useCallback(async () => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;
    if (!customerId || !accessToken) {
      log.log('[CheckoutScreen] loadData: Skipped - No customerId or accessToken');
      return;
    }
    try {
      log.log('[CheckoutScreen] loadData: Starting...', { customerId });
      setIsLoading(true);
      setErrorMessage(null);
      const [cartData, addressData] = await Promise.all([
        getCustomerCart({ customerId, accessToken }),
        getCustomerAddresses({ customerId, accessToken }),
      ]);
      log.log('[CheckoutScreen] loadData: Success', {
        cartItemsCount: cartData.items.length,
        addressesCount: addressData.length,
        cartSubtotal: cartData.subtotal,
        cartGrandTotal: cartData.grandTotal,
      });
      setCart(cartData);
      setAddresses(addressData);
      if (!selectedAddressId && addressData.length > 0) {
        const defaultAddress = addressData.find((a) => a.default) ?? addressData[0];
        log.log('[CheckoutScreen] loadData: Setting default address', { addressId: defaultAddress.id });
        setSelectedAddressId(defaultAddress.id);
      }
    } catch (error: any) {
      log.error('[CheckoutScreen] loadData: Failed', {
        status: error?.response?.status,
        message: error?.message,
        error,
      });
      const message =
        error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.message?.includes('Network')
          ? 'Không có kết nối mạng. Vui lòng thử lại.'
          : 'Không thể tải dữ liệu checkout. Vui lòng thử lại.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
      log.log('[CheckoutScreen] loadData: Completed');
    }
  }, [authState.accessToken, authState.decodedToken?.customerId, selectedAddressId]);

  // Load vouchers for products (only once when cart is loaded)
  // Load platform vouchers để build platformVouchers payload
  useEffect(() => {
    if (!cart || cart.items.length === 0) {
      throttledLog('loadVouchers_skipped', () => {
        log.log('[CheckoutScreen] loadVouchers: Skipped - No cart or empty items');
      });
      vouchersLoadedRef.current = null; // Reset when cart is empty
      return;
    }
    
    // Check if vouchers have already been loaded for this cart
    if (vouchersLoadedRef.current === cart.cartId) {
      throttledLog('loadVouchers_already_loaded', () => {
        log.log('[CheckoutScreen] loadVouchers: Already loaded for this cart', {
          cartId: cart.cartId,
        });
      });
      return;
    }
    
    // Chỉ load cho items được chọn (selectedCartItemIds)
    const itemsToLoad = selectedCartItemIds.length > 0
      ? cart.items.filter((item) => selectedCartItemIds.includes(item.cartItemId))
      : cart.items;
    
    const loadVouchers = async () => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) {
        // log.log('[CheckoutScreen] loadVouchers: Skipped - No customerId or accessToken');
        return;
      }

      try {
        // Chỉ load vouchers cho items được chọn
        const uniqueProductIds = Array.from(new Set(itemsToLoad.map((item) => item.refId)));
        throttledLog('loadVouchers_start', () => {
          log.log('[CheckoutScreen] loadVouchers: Starting...', {
            productIdsCount: uniqueProductIds.length,
            productIds: uniqueProductIds,
            selectedItemsCount: itemsToLoad.length,
          });
        });
        const voucherPromises = uniqueProductIds.map(async (productId) => {
          try {
            const [voucherData, productData] = await Promise.all([
              getProductVouchers(productId).catch(() => null),
              getProductById(productId).catch(() => null),
            ]);

             // Update product cache
             if (productData) {
               // log.log(`[CheckoutScreen] loadVouchers: Product ${productId} loaded`, {
               //   storeId: productData.storeId,
               //   storeName: productData.storeName,
               //   weight: productData.weight,
               //   districtCode: productData.districtCode,
               //   wardCode: productData.wardCode,
               // });
               setProductCache((prev) => ({
                 ...prev,
                 [productId]: {
                   productId,
                   storeId: productData.storeId,
                   storeName: productData.storeName,
                   weight: productData.weight ?? 0.5,
                   districtCode: productData.districtCode || '',
                   wardCode: productData.wardCode || '',
                 },
               }));
             } else {
               // log.log(`[CheckoutScreen] loadVouchers: Product ${productId} - No product data`);
             }

            // Process shop vouchers
            const shopVouchers = (voucherData?.vouchers?.shop as any[]) || [];
            // log.log(`[CheckoutScreen] loadVouchers: Product ${productId} - Shop vouchers`, {
            //   count: shopVouchers.length,
            // });
            const shopVouchersWithStore = shopVouchers.map((v) => ({
              ...v,
              storeId: productData?.storeId,
              storeName: productData?.storeName,
            }));

            // Process platform vouchers
            // Ưu tiên: vouchers.platformVouchers (cấu trúc mới)
            // Fallback: vouchers.platform (legacy)
            const platformVouchers = voucherData?.vouchers?.platformVouchers || [];
            const platformCampaigns = voucherData?.vouchers?.platform || [];
            const now = new Date();
            
            let activeCampaign: PlatformCampaign | null = null;
            let activeVoucher: PlatformVoucherItem | null = null;
            
            // Tìm trong platformVouchers trước (cấu trúc mới)
            if (platformVouchers.length > 0) {
              for (const campaign of platformVouchers) {
                if (campaign.status === 'ACTIVE' && campaign.vouchers && campaign.vouchers.length > 0) {
                  const start = campaign.startTime ? new Date(campaign.startTime) : null;
                  const end = campaign.endTime ? new Date(campaign.endTime) : null;
                  if ((!start || start <= now) && (!end || end >= now)) {
                    const voucher = campaign.vouchers.find((v: PlatformVoucherItem) => {
                      if (!v) return false;
                      const vStart = v.startTime ? new Date(v.startTime) : null;
                      const vEnd = v.endTime ? new Date(v.endTime) : null;
                      return (v.status === 'ACTIVE' || !v.status) && (!vStart || vStart <= now) && (!vEnd || vEnd >= now);
                    });
                    if (voucher) {
                      activeCampaign = campaign as any;
                      activeVoucher = voucher;
                      break;
                    }
                  }
                }
              }
            }
            
            // Fallback: Tìm trong platformCampaigns (legacy)
            if (!activeVoucher && platformCampaigns.length > 0) {
              activeCampaign = platformCampaigns.find((c: PlatformCampaign) => {
                if (!c || c.status !== 'ACTIVE') return false;
                const start = c.startTime ? new Date(c.startTime) : null;
                const end = c.endTime ? new Date(c.endTime) : null;
                return (!start || start <= now) && (!end || end >= now);
              }) || null;

              if (activeCampaign) {
                activeVoucher = activeCampaign.vouchers?.find((v: PlatformVoucherItem) => {
                  if (!v) return false;
                  const start = v.startTime ? new Date(v.startTime) : null;
                  const end = v.endTime ? new Date(v.endTime) : null;
                  return (v.status === 'ACTIVE' || !v.status) && (!start || start <= now) && (!end || end >= now);
                }) || null;
              }
            }

            let platformDiscount = 0;
            let campaignProductId = '';
            let platformVoucherId: string | undefined = undefined;
            
            if (activeVoucher && productData) {
              const basePrice = productData.price ?? 0;
              if (activeVoucher.type === 'PERCENT' && activeVoucher.discountPercent) {
                const discountValue = (basePrice * activeVoucher.discountPercent) / 100;
                platformDiscount =
                  activeVoucher.maxDiscountValue !== null &&
                  activeVoucher.maxDiscountValue !== undefined
                    ? Math.min(discountValue, activeVoucher.maxDiscountValue)
                    : discountValue;
              } else if (activeVoucher.type === 'FIXED' && activeVoucher.discountValue) {
                platformDiscount = activeVoucher.discountValue;
              }
              
              // Ưu tiên: platformVoucherId, fallback: campaignId
              platformVoucherId = activeVoucher.platformVoucherId;
              campaignProductId = platformVoucherId || activeCampaign?.campaignId || '';
            }

            // Check if item is in platform campaign from cart
            const cartItem = cart.items.find((item) => item.refId === productId);
            const inPlatformCampaign = cartItem?.inPlatformCampaign || false;

            // log.log(`[CheckoutScreen] loadVouchers: Product ${productId} - Platform voucher`, {
            //   platformDiscount,
            //   campaignProductId,
            //   inPlatformCampaign,
            //   platformVoucherId: activeVoucher?.platformVoucherId,
            // });

            setPlatformVoucherDiscounts((prev) => ({
              ...prev,
              [productId]: {
                discount: platformDiscount,
                campaignProductId,
                inPlatformCampaign,
                platformVoucherId,
              },
            }));

            return { shopVouchers: shopVouchersWithStore, storeId: productData?.storeId || null };
          } catch (error) {
            // log.error(`[CheckoutScreen] Failed to load vouchers for product ${productId}`, error);
            return { shopVouchers: [], storeId: null };
          }
        });

        const allResults = await Promise.all(voucherPromises);
        
        // Tạo map từ productId sang result để dễ tìm sau này
        const productIdToResultMap = new Map<string, { shopVouchers: ShopVoucherFromAPI[]; storeId: string | null }>();
        uniqueProductIds.forEach((productId, index) => {
          if (allResults[index]) {
            productIdToResultMap.set(productId, allResults[index]);
          }
        });
        
        const allShopVouchers = allResults.map((r) => r.shopVouchers);
        const flatShopVouchers = allShopVouchers.flat();
        // Dedup by code
        const uniqueVouchers = Array.from(
          new Map(flatShopVouchers.map((v) => [v.code, v])).values(),
        );
        throttledLog('loadVouchers_shop', () => {
          log.log('[CheckoutScreen] loadVouchers: Shop vouchers loaded', {
            total: flatShopVouchers.length,
            unique: uniqueVouchers.length,
          });
        });
        setAvailableVouchers(uniqueVouchers);

        // Load store-wide vouchers
        // Get storeIds from the fetched product data (not from productCache to avoid dependency issues)
        const storeIds = Array.from(
          new Set(
            allResults
              .map((r: { shopVouchers: any[]; storeId: string | null }) => r.storeId)
              .filter((storeId: string | null): storeId is string => !!storeId),
          ),
        ) as string[];

        throttledLog('loadVouchers_store_wide', () => {
          log.log('[CheckoutScreen] loadVouchers: Loading store-wide vouchers', {
            storeIdsCount: storeIds.length,
            storeIds,
          });
        });

        const storeWidePromises = storeIds
          .filter((storeId) => storeId && storeId.trim() !== '')
          .map(async (storeId) => {
            try {
              // log.log(`[CheckoutScreen] loadVouchers: Fetching store-wide vouchers for store ${storeId}`);
              const vouchers = await getShopVouchersByStore(storeId, 'ACTIVE', 'ALL_SHOP_VOUCHER');
              // log.log(`[CheckoutScreen] loadVouchers: Store ${storeId} - Store-wide vouchers loaded`, {
              //   count: vouchers.length,
              // });
              return { storeId, vouchers };
            } catch (error) {
              // getShopVouchersByStore already handles 404, so this is for other errors
              // log.log(`[CheckoutScreen] loadVouchers: Store ${storeId} - No store-wide vouchers`);
              return { storeId, vouchers: [] };
            }
          });

        const storeWideResults = await Promise.all(storeWidePromises);
        const storeWideMap: Record<string, ShopVoucher[]> = {};
        const storeVouchersMap = new Map<string, ShopVoucherFromAPI[]>();
        storeWideResults.forEach(({ storeId, vouchers }) => {
          storeWideMap[storeId] = vouchers;
          // Lưu vào Map cho shop vouchers (ALL_SHOP_VOUCHER)
          storeVouchersMap.set(storeId, vouchers as ShopVoucherFromAPI[]);
        });
        throttledLog('loadVouchers_store_wide_loaded', () => {
          log.log('[CheckoutScreen] loadVouchers: Store-wide vouchers loaded', {
            storesCount: Object.keys(storeWideMap).length,
            totalVouchers: Object.values(storeWideMap).reduce((sum, v) => sum + v.length, 0),
          });
        });
        setStoreWideVouchers(storeWideMap);
        setStoreVouchers(storeVouchersMap);

        // Load product vouchers (PRODUCT_VOUCHER scope)
        // Lấy từ shop vouchers đã load ở trên, lọc theo scopeType hoặc scope
        const productVouchersMap = new Map<string, ShopVoucherFromAPI[]>();
        itemsToLoad.forEach((item) => {
          // Tìm result từ productIdToResultMap dựa trên item.refId (productId)
          const result = productIdToResultMap.get(item.refId);
          
          if (result && result.shopVouchers) {
            // Lọc ra vouchers có scopeType: "PRODUCT_VOUCHER" hoặc scope: "PRODUCT"
            const productVouchersList = result.shopVouchers.filter(
              (v: ShopVoucherFromAPI) => v.scopeType === 'PRODUCT_VOUCHER' || v.scope === 'PRODUCT',
            );
            if (productVouchersList.length > 0) {
              productVouchersMap.set(item.cartItemId, productVouchersList);
            }
          }
        });
        setProductVouchers(productVouchersMap);
        
        // Mark vouchers as loaded for this cart
        vouchersLoadedRef.current = cart.cartId;
      } catch (error) {
        // log.error('[CheckoutScreen] loadVouchers: Failed', error);
      }
    };

    loadVouchers();
  }, [cart, selectedCartItemIds, authState.decodedToken?.customerId, authState.accessToken]); // Added selectedCartItemIds to load vouchers for selected items only

  // Fetch missing product details for shipping calculation
  const fetchMissingProductDetails = useCallback(
    async (productIds: string[]) => {
      if (productIds.length === 0) {
        throttledLog('fetchMissingProductDetails_skipped', () => {
          log.log('[CheckoutScreen] fetchMissingProductDetails: Skipped - No productIds');
        });
        return productCache;
      }
      
      const missingIds = productIds.filter((id) => !productCache[id]);
      if (missingIds.length === 0) {
        throttledLog('fetchMissingProductDetails_cached', () => {
          log.log('[CheckoutScreen] fetchMissingProductDetails: All products already in cache', {
            total: productIds.length,
          });
        });
        return productCache;
      }

      throttledLog('fetchMissingProductDetails_start', () => {
        log.log('[CheckoutScreen] fetchMissingProductDetails: Starting...', {
          total: productIds.length,
          missing: missingIds.length,
          missingIds,
        });
      });

      try {
        const productPromises = missingIds.map(async (productId) => {
          try {
            // log.log(`[CheckoutScreen] fetchMissingProductDetails: Fetching product ${productId}`);
            const product = await getProductById(productId);
            // log.log(`[CheckoutScreen] fetchMissingProductDetails: Product ${productId} loaded`, {
            //   storeId: product.storeId,
            //   storeName: product.storeName,
            //   weight: product.weight,
            //   districtCode: product.districtCode,
            //   wardCode: product.wardCode,
            // });
            return {
              productId,
              storeId: product.storeId,
              storeName: product.storeName,
              weight: product.weight ?? 0.5,
              districtCode: product.districtCode || '',
              wardCode: product.wardCode || '',
            };
          } catch (error: any) {
            if (error?.response?.status !== 404) {
              // log.error(`[CheckoutScreen] fetchMissingProductDetails: Failed to fetch product ${productId}`, error);
            } else {
              // log.log(`[CheckoutScreen] fetchMissingProductDetails: Product ${productId} not found (404)`);
            }
            return null;
          }
        });

        const results = await Promise.all(productPromises);
        const newCache: Record<string, ProductCacheItem> = {};
        results.forEach((result) => {
          if (result) {
            newCache[result.productId] = result;
          }
        });

        throttledLog('fetchMissingProductDetails_completed', () => {
          log.log('[CheckoutScreen] fetchMissingProductDetails: Completed', {
            fetched: Object.keys(newCache).length,
            totalInCache: Object.keys({ ...productCache, ...newCache }).length,
          });
        });

        setProductCache((prev) => ({ ...prev, ...newCache }));
        return { ...productCache, ...newCache };
      } catch (error) {
        // log.error('[CheckoutScreen] fetchMissingProductDetails: Failed', error);
        return productCache;
      }
    },
    [productCache],
  );

  // Calculate shipping fee with GHN API
  // Flow: 1. User chọn địa chỉ → 2. Debounce & Filter → 3. Fetch product details → 4. Group by store → 5. Calculate per store → 6. Handle response → 7. Sum total
  useEffect(() => {
    // Step 1: User chọn địa chỉ nhận hàng → selectedAddressId thay đổi
    if (!selectedAddressId || cartItems.length === 0 || !addresses.length) {
      setShippingFee(0);
      setStoreShippingFees({});
      setStoreNames({});
      setShippingFeeError(null);
      setIsCalculatingShipping(false);
      return;
    }

    // Step 2: Debounce và throttle để tránh spam API
    const timeoutId = setTimeout(async () => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) {
        // log.log('[CheckoutScreen] calculateShippingFee: Skipped - No customerId or accessToken');
        return;
      }

      // Throttle: chỉ gọi nếu đã qua 2 giây kể từ lần gọi trước
      const now = Date.now();
      const timeSinceLastCall = now - lastShippingCallRef.current;
      if (timeSinceLastCall < SHIPPING_THROTTLE_MS) {
        // Chưa đủ thời gian, bỏ qua
        return;
      }

      const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
      if (!selectedAddress) {
        throttledLog('calculateShippingFee_no_address', () => {
          log.log('[CheckoutScreen] calculateShippingFee: Skipped - No selected address');
        });
        return;
      }

      // Update last call time
      lastShippingCallRef.current = Date.now();

      throttledLog('calculateShippingFee_start', () => {
        log.log('[CheckoutScreen] calculateShippingFee: Starting...', {
          addressId: selectedAddressId,
          address: {
            province: selectedAddress.province,
            district: selectedAddress.district,
            ward: selectedAddress.ward,
          },
        });
      });

      // Validate address
      if (!selectedAddress.provinceCode || !selectedAddress.districtId || !selectedAddress.wardCode) {
        // log.log('[CheckoutScreen] calculateShippingFee: Invalid address - Missing required fields');
        setShippingFeeError('Địa chỉ giao hàng chưa đầy đủ thông tin');
        setShippingFee(0);
        setIsCalculatingShipping(false);
        return;
      }

      try {
        setIsCalculatingShipping(true);
        setShippingFeeError(null);

        // Filter items đã được chọn (isSelected = true)
        const selectedItems = cartItems.filter((item) => item.isSelected);
        throttledLog('calculateShippingFee_selected_items', () => {
          log.log('[CheckoutScreen] calculateShippingFee: Selected items', {
            total: cartItems.length,
            selected: selectedItems.length,
          });
        });
        if (selectedItems.length === 0) {
          // log.log('[CheckoutScreen] calculateShippingFee: No selected items');
          setShippingFee(0);
          setStoreShippingFees({});
          setIsCalculatingShipping(false);
          return;
        }

        // Step 3: Fetch missing product details
        const productIds = Array.from(new Set(selectedItems.map((item) => item.refId)));
        throttledLog('calculateShippingFee_fetch_products', () => {
          log.log('[CheckoutScreen] calculateShippingFee: Fetching product details', {
            productIdsCount: productIds.length,
            productIds,
          });
        });
        const updatedCache = await fetchMissingProductDetails(productIds);
        const cacheToUse = updatedCache || productCache;
        throttledLog('calculateShippingFee_cache_ready', () => {
          log.log('[CheckoutScreen] calculateShippingFee: Product cache ready', {
            cacheSize: Object.keys(cacheToUse).length,
          });
        });

        // Step 4: Group items theo storeId
        const itemsByStore: Record<string, typeof selectedItems> = {};
        const storeNameMap: Record<string, string> = {};

        selectedItems.forEach((item) => {
          const cache = cacheToUse[item.refId];
          if (!cache?.storeId) {
            // log.log(`[CheckoutScreen] calculateShippingFee: Item ${item.refId} - No storeId in cache`);
            return;
          }
          const storeId = cache.storeId;
          if (!itemsByStore[storeId]) {
            itemsByStore[storeId] = [];
          }
          itemsByStore[storeId].push(item);
          storeNameMap[storeId] = cache.storeName || 'Unknown Store';
        });

        throttledLog('calculateShippingFee_grouped', () => {
          log.log('[CheckoutScreen] calculateShippingFee: Grouped by store', {
            storesCount: Object.keys(itemsByStore).length,
            stores: Object.keys(itemsByStore).map((storeId) => ({
              storeId,
              storeName: storeNameMap[storeId],
              itemsCount: itemsByStore[storeId].length,
            })),
          });
        });

        if (Object.keys(itemsByStore).length === 0) {
          // log.log('[CheckoutScreen] calculateShippingFee: No stores found');
          setShippingFeeError('Không thể xác định cửa hàng cho các sản phẩm');
          setIsCalculatingShipping(false);
          return;
        }

        setStoreNames(storeNameMap);

        // Step 5: Với mỗi store (song song): Calculate shipping fee
        const storeFeePromises = Object.entries(itemsByStore).map(async ([storeId, storeItems]) => {
          try {
            // log.log(`[CheckoutScreen] calculateShippingFee: Processing store ${storeId}`, {
            //   itemsCount: storeItems.length,
            //   storeName: storeNameMap[storeId],
            // });

            // a. Lấy địa chỉ gửi từ store default address API
            // Ưu tiên: Lấy từ cache, nếu không có thì gọi API
            const firstItem = storeItems[0];
            let fromDistrictId: number | null = null;
            let fromWardCode: string | null = null;
            
            // Kiểm tra cache trước
            const cachedAddress = storeAddressCacheRef.current.get(storeId);
            if (cachedAddress) {
              fromDistrictId = parseInt(cachedAddress.districtCode);
              fromWardCode = cachedAddress.wardCode;
            } else {
              // Gọi API để lấy store default address
              try {
                const storeAddress = await getStoreDefaultAddressByProduct(firstItem.refId);
                if (storeAddress && storeAddress.districtCode && storeAddress.wardCode) {
                  fromDistrictId = parseInt(storeAddress.districtCode);
                  fromWardCode = storeAddress.wardCode;
                  // Cache địa chỉ để tránh gọi lại
                  storeAddressCacheRef.current.set(storeId, {
                    districtCode: storeAddress.districtCode,
                    wardCode: storeAddress.wardCode,
                  });
                } else {
                  // Fallback: Dùng địa chỉ từ product cache
                  const firstItemCache = cacheToUse[firstItem.refId];
                  if (firstItemCache?.districtCode && firstItemCache?.wardCode) {
                    fromDistrictId = parseInt(firstItemCache.districtCode);
                    fromWardCode = firstItemCache.wardCode;
                  }
                }
              } catch (error) {
                // Fallback: Dùng địa chỉ từ product cache
                const firstItemCache = cacheToUse[firstItem.refId];
                if (firstItemCache?.districtCode && firstItemCache?.wardCode) {
                  fromDistrictId = parseInt(firstItemCache.districtCode);
                  fromWardCode = firstItemCache.wardCode;
                }
              }
            }

            if (!fromDistrictId || !fromWardCode) {
              // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - Missing origin address`);
              return { storeId, fee: 0, error: 'Missing origin address' };
            }

            // b. Build GHN items
            const ghnItems = buildGHNItems(storeItems, cacheToUse);
            // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - GHN items built`, {
            //   itemsCount: ghnItems.length,
            // });

            // c. Tính tổng weight của package
            const totalWeightGrams = calculateTotalWeightGrams(storeItems, cacheToUse);
            // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - Total weight`, {
            //   weightGrams: totalWeightGrams,
            //   weightKg: (totalWeightGrams / 1000).toFixed(2),
            // });
            if (totalWeightGrams === 0) {
              // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - Zero weight`);
              return { storeId, fee: 0, error: 'Zero weight' };
            }

            // d. Tính service type (2 hoặc 5)
            const serviceType = calculateServiceType(storeItems, cacheToUse);
            // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - Service type`, {
            //   serviceType,
            //   weightGrams: totalWeightGrams,
            // });

            // e. Build request body
            const ghnRequest = {
              service_type_id: serviceType as 2 | 5,
              from_district_id: fromDistrictId,
              from_ward_code: fromWardCode,
              to_district_id: selectedAddress.districtId,
              to_ward_code: selectedAddress.wardCode,
              weight: totalWeightGrams, // grams
              items: ghnItems,
            };

            // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - Calling GHN API`, {
            //   serviceType,
            //   fromDistrictId,
            //   fromWardCode,
            //   toDistrictId: selectedAddress.districtId,
            //   toWardCode: selectedAddress.wardCode,
            //   weightGrams: totalWeightGrams,
            // });

            // f. Gọi GHN API
            const fee = await calculateGHNFee(ghnRequest, accessToken);
            
            // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - GHN API response`, {
            //   fee,
            //   storeName: storeNameMap[storeId],
            // });
            
            // Step 6: Xử lý response từ GHN API
            return { storeId, fee, error: null };
          } catch (error: any) {
            // Step 6: Xử lý error
            if (error?.response?.status === 404) {
              // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - Service not available (404)`);
              return { storeId, fee: 0, error: null }; // Service not available, not an error
            }
            const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
            // log.error(`[CheckoutScreen] calculateShippingFee: Store ${storeId} - Error`, {
            //   status: error?.response?.status,
            //   message: errorMessage,
            // });
            return { storeId, fee: 0, error: errorMessage };
          }
        });

        // Step 7: Sum tổng shipping fee từ tất cả stores
        const storeFeeResults = await Promise.all(storeFeePromises);
        const feesMap: Record<string, number> = {};
        const errorsMap: Record<string, string> = {};
        let totalFee = 0;
        let hasError = false;

        // log.log('[CheckoutScreen] calculateShippingFee: Processing results', {
        //   storesCount: storeFeeResults.length,
        // });

        storeFeeResults.forEach(({ storeId, fee, error }) => {
          feesMap[storeId] = fee;
          totalFee += fee;
          if (error) {
            errorsMap[storeId] = error;
            hasError = true;
          }
          // log.log(`[CheckoutScreen] calculateShippingFee: Store ${storeId} result`, {
          //   fee,
          //   error: error || null,
          //   storeName: storeNameMap[storeId],
          // });
        });

        throttledLog('calculateShippingFee_summary', () => {
          log.log('[CheckoutScreen] calculateShippingFee: Final summary', {
            totalFee,
            storeFees: feesMap,
            hasError,
            errors: hasError ? errorsMap : null,
          });
        });

        setStoreShippingFees(feesMap);
        setShippingFee(totalFee);
        
        // Hiển thị error nếu có store nào lỗi
        if (hasError) {
          const errorMessages = Object.entries(errorsMap)
            .map(([storeId, error]) => `${storeNameMap[storeId] || storeId}: ${error}`)
            .join('; ');
          setShippingFeeError(`Một số cửa hàng không thể tính phí vận chuyển: ${errorMessages}`);
        } else {
          setShippingFeeError(null);
        }
      } catch (error: any) {
        // log.error('[CheckoutScreen] calculateShippingFee: Failed', {
        //   status: error?.response?.status,
        //   message: error?.message,
        //   error,
        // });
        setShippingFeeError('Không thể tính phí ship. Vui lòng thử lại.');
        setShippingFee(0);
        setStoreShippingFees({});
      } finally {
        setIsCalculatingShipping(false);
        throttledLog('calculateShippingFee_completed', () => {
          log.log('[CheckoutScreen] calculateShippingFee: Completed');
        });
      }
    }, 1500); // Debounce 1.5 seconds

    return () => clearTimeout(timeoutId);
  }, [
    selectedAddressId,
    cartItems.length, // Chỉ track length thay vì toàn bộ array
    addresses.length, // Chỉ track length thay vì toàn bộ array
    // Removed productCache and fetchMissingProductDetails from dependencies
    authState.decodedToken?.customerId,
    authState.accessToken,
  ]);

  // Load checkout session từ AsyncStorage
  useEffect(() => {
    const loadCheckoutSession = async () => {
      try {
        const raw = await AsyncStorage.getItem(CHECKOUT_SESSION_KEY);
        if (raw) {
          const payload = JSON.parse(raw);
          
          // Load selectedCartItemIds
          if (payload.selectedCartItemIds && Array.isArray(payload.selectedCartItemIds)) {
            setSelectedCartItemIds(payload.selectedCartItemIds);
          }
          
          // Load selectedShopVouchers (Map<storeId, { shopVoucherId, code }>)
          if (payload.storeVouchers) {
            const shopVouchersMap = new Map<string, { shopVoucherId: string; code: string }>();
            Object.entries(payload.storeVouchers).forEach(([storeId, voucher]: [string, any]) => {
              if (voucher && typeof voucher === 'object' && voucher.shopVoucherId && voucher.code) {
                shopVouchersMap.set(storeId, {
                  shopVoucherId: voucher.shopVoucherId,
                  code: voucher.code,
                });
              } else if (typeof voucher === 'string') {
                // Legacy format: storeId -> code
                shopVouchersMap.set(storeId, {
                  shopVoucherId: voucher,
                  code: voucher,
                });
              }
            });
            setSelectedShopVouchers(shopVouchersMap);
          }
          
          // Load selectedProductVouchers (Map<cartItemId, { shopVoucherId, code }>)
          if (payload.productVouchers) {
            const productVouchersMap = new Map<string, { shopVoucherId: string; code: string }>();
            Object.entries(payload.productVouchers).forEach(([cartItemId, voucher]: [string, any]) => {
              if (voucher && typeof voucher === 'object' && voucher.shopVoucherId && voucher.code) {
                productVouchersMap.set(cartItemId, {
                  shopVoucherId: voucher.shopVoucherId,
                  code: voucher.code,
                });
              }
            });
            setSelectedProductVouchers(productVouchersMap);
          }
          
          // Load selectedAddressId
          if (payload.selectedAddressId) {
            setSelectedAddressId(payload.selectedAddressId);
          }
        }
      } catch (error) {
        console.error('[CheckoutScreen] Failed to load checkout session', error);
      }
    };
    
    void loadCheckoutSession();
  }, []);

  // Prefill cart and vouchers from navigation params
  // Lưu ý: Route params chỉ dùng để prefill nhanh, nhưng AsyncStorage là nguồn chính
  useEffect(() => {
    const params = route.params;
    if (params?.cart) {
      setCart(params.cart);
      
      // Restore selectedCartItemIds từ params (nếu có)
      if (params.selectedCartItemIds && Array.isArray(params.selectedCartItemIds)) {
        setSelectedCartItemIds(params.selectedCartItemIds);
      }
      
      // Restore shop vouchers từ params vào selectedShopVouchers (format mới)
      if (params.storeVouchers) {
        const shopVouchersMap = new Map<string, { shopVoucherId: string; code: string }>();
        Object.entries(params.storeVouchers).forEach(([storeId, voucher]: [string, any]) => {
          if (voucher && typeof voucher === 'object' && voucher.shopVoucherId && voucher.code) {
            shopVouchersMap.set(storeId, {
              shopVoucherId: voucher.shopVoucherId,
              code: voucher.code,
            });
          }
        });
        setSelectedShopVouchers(shopVouchersMap);
        
        // Legacy: Cũng restore vào appliedStoreWideVouchers để tương thích
        const restoredStoreWideVouchers: Record<string, AppliedStoreWideVoucher> = {};
        Object.entries(params.storeVouchers).forEach(([storeId, voucher]: [string, any]) => {
          if (voucher && typeof voucher === 'object') {
            restoredStoreWideVouchers[storeId] = {
              voucherId: voucher.shopVoucherId,
              code: voucher.code,
              storeId: storeId,
              discountValue: 0,
              type: 'PERCENT',
            };
          }
        });
        setAppliedStoreWideVouchers(restoredStoreWideVouchers);
      }
      
      // Restore product vouchers từ params vào selectedProductVouchers (format mới)
      if (params.productVouchers) {
        const productVouchersMap = new Map<string, { shopVoucherId: string; code: string }>();
        Object.entries(params.productVouchers).forEach(([cartItemId, voucher]: [string, any]) => {
          if (voucher && typeof voucher === 'object' && voucher.shopVoucherId && voucher.code) {
            productVouchersMap.set(cartItemId, {
              shopVoucherId: voucher.shopVoucherId,
              code: voucher.code,
            });
          }
        });
        setSelectedProductVouchers(productVouchersMap);
        
        // Legacy: Cũng restore vào appliedStoreVouchers để tương thích
        if (params.cart) {
          const restoredProductVouchers: Record<string, AppliedStoreVoucher> = {};
          Object.entries(params.productVouchers).forEach(([cartItemId, voucher]: [string, any]) => {
            const cartItem = params.cart!.items.find((item) => item.cartItemId === cartItemId);
            if (cartItem && voucher && typeof voucher === 'object') {
              const productId = cartItem.refId;
              restoredProductVouchers[productId] = {
                voucherId: voucher.shopVoucherId,
                code: voucher.code,
                storeId: '',
                discountValue: 0,
                type: 'PERCENT',
              };
            }
          });
          setAppliedStoreVouchers(restoredProductVouchers);
        }
      }
    }
  }, [route.params]);

  // Load data only once when screen mounts or when authenticated
  // Skip loading cart if cart is already provided from navigation params
  useEffect(() => {
    if (isAuthenticated && !hasLoadedRef.current) {
      // If cart is provided from params, only load addresses
      if (route.params?.cart) {
        const customerId = authState.decodedToken?.customerId;
        const accessToken = authState.accessToken;
        if (customerId && accessToken) {
          getCustomerAddresses({ customerId, accessToken })
            .then((addressData) => {
              setAddresses(addressData);
              if (!selectedAddressId && addressData.length > 0) {
                const defaultAddress = addressData.find((a) => a.default) ?? addressData[0];
                setSelectedAddressId(defaultAddress.id);
              }
            })
            .catch((error) => {
              console.error('[CheckoutScreen] Failed to load addresses', error);
            });
        }
        hasLoadedRef.current = true;
      } else {
        // No cart from params, load everything
        loadData();
        hasLoadedRef.current = true;
      }
    } else if (!isAuthenticated) {
      throttledLog('not_authenticated', () => {
        log.log('[CheckoutScreen] Not authenticated');
      });
    }
  }, [isAuthenticated, loadData, route.params?.cart, authState.decodedToken?.customerId, authState.accessToken, selectedAddressId]);

  useEffect(() => {
    if (!isAuthenticated) {
      // log.log('[CheckoutScreen] Not authenticated, redirecting to Profile...');
      const tabNavigator = navigation.getParent();
      tabNavigator?.navigate('Profile' as never);
    }
  }, [isAuthenticated, navigation]);

  // Calculate store totals (after platform discount)
  const storeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    cartItems.forEach((item) => {
      const cache = productCache[item.refId];
      const storeId = cache?.storeId;
      if (!storeId) return;
      totals[storeId] = (totals[storeId] || 0) + item.finalPrice * item.quantity;
    });
    return totals;
  }, [cartItems, productCache]);

  // Apply/remove store voucher
  const handleApplyStoreVoucher = useCallback(
    (voucher: ShopVoucher, productId: string) => {
      // log.log('[CheckoutScreen] handleApplyStoreVoucher: Starting...', {
      //   voucherCode: voucher.code,
      //   voucherId: voucher.voucherId,
      //   productId,
      //   storeId: voucher.storeId,
      // });

      const storeTotal = storeTotals[voucher.storeId || ''] || 0;
      // log.log('[CheckoutScreen] handleApplyStoreVoucher: Store total', {
      //   storeTotal,
      //   minOrderValue: voucher.minOrderValue,
      // });

      if (voucher.minOrderValue && storeTotal < voucher.minOrderValue) {
        // log.log('[CheckoutScreen] handleApplyStoreVoucher: Validation failed - Min order value not met');
        setSnackbarMessage(
          `Voucher yêu cầu đơn hàng tối thiểu ${formatCurrencyVND(voucher.minOrderValue)}`,
        );
        setSnackbarVisible(true);
        return;
      }

      let discountValue = 0;
      if (voucher.type === 'PERCENT' && voucher.discountPercent) {
        const discount = (storeTotal * voucher.discountPercent) / 100;
        discountValue =
          voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
            ? Math.min(discount, voucher.maxDiscountValue)
            : discount;
      } else if (voucher.type === 'FIXED' && voucher.discountValue) {
        discountValue = voucher.discountValue;
      }

      // log.log('[CheckoutScreen] handleApplyStoreVoucher: Applied', {
      //   voucherCode: voucher.code,
      //   discountValue,
      //   type: voucher.type,
      // });

      setAppliedStoreVouchers((prev) => ({
        ...prev,
        [productId]: {
          voucherId: voucher.voucherId,
          code: voucher.code,
          storeId: voucher.storeId || '',
          discountValue,
          type: voucher.type,
        },
      }));
    },
    [storeTotals],
  );

  const handleRemoveStoreVoucher = useCallback((productId: string) => {
    // log.log('[CheckoutScreen] handleRemoveStoreVoucher: Removing voucher', { productId });
    setAppliedStoreVouchers((prev) => {
      const next = { ...prev };
      delete next[productId];
      // log.log('[CheckoutScreen] handleRemoveStoreVoucher: Removed', {
      //   productId,
      //   remainingVouchers: Object.keys(next).length,
      // });
      return next;
    });
  }, []);

  // Apply/remove store-wide voucher
  const handleApplyStoreWideVoucher = useCallback(
    (voucher: ShopVoucher, storeId: string) => {
      // log.log('[CheckoutScreen] handleApplyStoreWideVoucher: Starting...', {
      //   voucherCode: voucher.code,
      //   voucherId: voucher.voucherId,
      //   storeId,
      // });

      const storeTotal = storeTotals[storeId] || 0;
      // log.log('[CheckoutScreen] handleApplyStoreWideVoucher: Store total', {
      //   storeTotal,
      //   minOrderValue: voucher.minOrderValue,
      // });

      if (voucher.minOrderValue && storeTotal < voucher.minOrderValue) {
        // log.log('[CheckoutScreen] handleApplyStoreWideVoucher: Validation failed - Min order value not met');
        setSnackbarMessage(
          `Voucher yêu cầu đơn hàng tối thiểu ${formatCurrencyVND(voucher.minOrderValue)}`,
        );
        setSnackbarVisible(true);
        return;
      }

      let discountValue = 0;
      if (voucher.type === 'PERCENT' && voucher.discountPercent) {
        const discount = (storeTotal * voucher.discountPercent) / 100;
        discountValue =
          voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
            ? Math.min(discount, voucher.maxDiscountValue)
            : discount;
      } else if (voucher.type === 'FIXED' && voucher.discountValue) {
        discountValue = voucher.discountValue;
      }

      // log.log('[CheckoutScreen] handleApplyStoreWideVoucher: Applied', {
      //   voucherCode: voucher.code,
      //   discountValue,
      //   type: voucher.type,
      // });

      setAppliedStoreWideVouchers((prev) => ({
        ...prev,
        [storeId]: {
          voucherId: voucher.voucherId,
          code: voucher.code,
          storeId,
          discountValue,
          type: voucher.type,
        },
      }));
    },
    [storeTotals],
  );

  const handleRemoveStoreWideVoucher = useCallback((storeId: string) => {
    // log.log('[CheckoutScreen] handleRemoveStoreWideVoucher: Removing voucher', { storeId });
    setAppliedStoreWideVouchers((prev) => {
      const next = { ...prev };
      delete next[storeId];
      // log.log('[CheckoutScreen] handleRemoveStoreWideVoucher: Removed', {
      //   storeId,
      //   remainingVouchers: Object.keys(next).length,
      // });
      return next;
    });
  }, []);

  /**
   * Helper: Kiểm tra voucher có active không (dựa trên startTime, endTime, status)
   */
  const isVoucherActive = useCallback((voucher: ShopVoucherFromAPI): boolean => {
    const now = new Date();
    
    // Kiểm tra status - chỉ reject nếu status rõ ràng là INACTIVE hoặc EXPIRED
    if (voucher.status) {
      if (voucher.status === 'INACTIVE' || voucher.status === 'EXPIRED' || voucher.status === 'USED') {
        return false;
      }
    }
    
    // Kiểm tra thời gian
    if (voucher.startTime) {
      try {
        const startTime = new Date(voucher.startTime);
        if (!isNaN(startTime.getTime()) && now < startTime) {
          return false;
        }
      } catch (error) {
        // Invalid date format, skip check
      }
    }
    
    if (voucher.endTime) {
      try {
        const endTime = new Date(voucher.endTime);
        if (!isNaN(endTime.getTime()) && now > endTime) {
          return false;
        }
      } catch (error) {
        // Invalid date format, skip check
      }
    }
    
    return true;
  }, []);

  /**
   * Helper: Kiểm tra voucher có đủ điều kiện minOrderValue không
   */
  const isVoucherEligible = useCallback(
    (voucher: ShopVoucherFromAPI, storeId: string, items: typeof cartItems): boolean => {
      if (!voucher.minOrderValue) return true;

      // Tính subtotal gốc của store (chỉ tính items được chọn)
      const storeItems = items.filter((item) => {
        if (item.type !== 'PRODUCT') return false;
        const cache = productCache[item.refId];
        return cache?.storeId === storeId;
      });

      const storeBaseSubtotal = storeItems.reduce(
        (sum: number, item: typeof items[0]) => sum + (item.originalPrice ?? item.finalPrice) * item.quantity,
        0,
      );

      return storeBaseSubtotal >= voucher.minOrderValue;
    },
    [productCache],
  );

  // Calculate pricing - sử dụng preview data nếu có, fallback về tính toán thủ công
  // QUAN TRỌNG: Tính shop voucher và product voucher discount riêng biệt (giống CartScreen)
  const pricing = useMemo(() => {
    // Ưu tiên sử dụng preview data từ API
    if (previewData) {
      // Tính tổng platformDiscount từ stores
      let totalPlatformDiscount = 0;
      previewData.stores.forEach((store) => {
        totalPlatformDiscount += store.platformDiscount || 0;
      });
      
      // Fallback: Nếu preview data không có platformDiscount nhưng có thể tính từ cart items
      if (totalPlatformDiscount === 0 && cart && cartItems.length > 0) {
        const subtotalBeforePlatformDiscount = cartItems.reduce(
          (sum, item) => sum + item.originalPrice * item.quantity,
          0,
        );
        const subtotalAfterPlatformDiscount = cartItems.reduce(
          (sum, item) => sum + item.finalPrice * item.quantity,
          0,
        );
        totalPlatformDiscount = Math.max(
          0,
          subtotalBeforePlatformDiscount - subtotalAfterPlatformDiscount,
        );
      }

      // Tính shop voucher discount từ selectedShopVouchers (giống CartScreen)
      let shopVoucherDiscount = 0;
      selectedShopVouchers.forEach((voucherInfo, storeId) => {
        const vouchers = storeVouchers.get(storeId) || [];
        const voucher = vouchers.find(
          (v: ShopVoucherFromAPI) => (v.shopVoucherId || v.voucherId) === voucherInfo.shopVoucherId,
        );
        if (!voucher || !isVoucherActive(voucher)) {
          return;
        }

        // Lấy items của store này
        const storeItems = cartItems.filter((item) => {
          if (item.type !== 'PRODUCT') return false;
          const cache = productCache[item.refId];
          return cache?.storeId === storeId;
        });

        if (storeItems.length === 0) {
          return;
        }

        // Tính storeSubtotal: sử dụng finalPrice (giá SAU platform campaign) để tính discount
        const storeSubtotal = storeItems.reduce(
          (sum, item) => sum + item.finalPrice * item.quantity,
          0,
        );

        // Tính storeBaseSubtotal: sử dụng originalPrice (giá gốc) để kiểm tra minOrderValue
        const storeBaseSubtotal = storeItems.reduce(
          (sum, item) => sum + (item.originalPrice ?? item.finalPrice) * item.quantity,
          0,
        );

        // Kiểm tra minOrderValue
        if (voucher.minOrderValue && storeBaseSubtotal < voucher.minOrderValue) {
          return;
        }

        // Tính discount trên giá SAU platform campaign (finalPrice)
        let storeDiscount = 0;
        if (voucher.discountPercent !== null && voucher.discountPercent !== undefined && voucher.discountPercent > 0) {
          const discount = (storeSubtotal * voucher.discountPercent) / 100;
          storeDiscount = voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
            ? Math.min(discount, voucher.maxDiscountValue)
            : discount;
        } else if (voucher.discountValue !== null && voucher.discountValue !== undefined && voucher.discountValue > 0) {
          storeDiscount = voucher.discountValue;
        }

        shopVoucherDiscount += Math.round(storeDiscount);
      });

      // Tính product voucher discount từ selectedProductVouchers (giống CartScreen)
      let productVoucherDiscount = 0;
      selectedProductVouchers.forEach((voucherInfo, cartItemId) => {
        const vouchers = productVouchers.get(cartItemId) || [];
        const voucher = vouchers.find(
          (v: ShopVoucherFromAPI) => (v.shopVoucherId || v.voucherId) === voucherInfo.shopVoucherId,
        );
        if (!voucher || !isVoucherActive(voucher)) {
          return;
        }

        const item = cartItems.find((it) => it.cartItemId === cartItemId);
        if (!item) return;

        // Xác định giá để tính voucher discount
        // Ưu tiên: platformCampaignPrice (nếu có và đang trong campaign)
        // Fallback: originalPrice hoặc finalPrice
        const priceForVoucherCalculation = 
          item.inPlatformCampaign &&
          !item.campaignUsageExceeded &&
          item.platformCampaignPrice !== null &&
          item.platformCampaignPrice !== undefined
            ? item.platformCampaignPrice
            : (item.originalPrice ?? item.finalPrice);

        const itemSubtotal = priceForVoucherCalculation * item.quantity;

        // Kiểm tra minOrderValue
        if (voucher.minOrderValue && itemSubtotal < voucher.minOrderValue) {
          return;
        }

        // Tính discount trên giá đã xác định
        let itemDiscount = 0;
        if (voucher.discountPercent !== null && voucher.discountPercent !== undefined && voucher.discountPercent > 0) {
          const discount = (itemSubtotal * voucher.discountPercent) / 100;
          itemDiscount = voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
            ? Math.min(discount, voucher.maxDiscountValue)
            : discount;
        } else if (voucher.discountValue !== null && voucher.discountValue !== undefined && voucher.discountValue > 0) {
          itemDiscount = voucher.discountValue;
        }

        productVoucherDiscount += Math.round(itemDiscount);
      });

      // Tổng store discount = shop voucher discount + product voucher discount
      const totalStoreDiscount = shopVoucherDiscount + productVoucherDiscount;
      
      // Lấy platformDiscount và storeDiscount trực tiếp từ preview data (tổng từ tất cả stores)
      const previewPlatformDiscount = previewData.stores.reduce(
        (sum, store) => sum + (store.platformDiscount || 0),
        0,
      );
      const previewStoreDiscount = previewData.stores.reduce(
        (sum, store) => sum + (store.storeDiscount || 0),
        0,
      );
      
      // Sử dụng overallGrandTotal từ preview API làm total (chính xác nhất)
      const calculatedTotal = previewData.overallGrandTotal;
      
      return {
        subtotalBeforePlatformDiscount: previewData.overallSubtotal,
        subtotalAfterPlatformDiscount: previewData.overallSubtotal - totalPlatformDiscount,
        totalPlatformDiscount,
        shopVoucherDiscount,
        productVoucherDiscount,
        storeDiscount: totalStoreDiscount,
        // Thêm platformDiscount và storeDiscount từ preview data
        platformDiscount: previewPlatformDiscount,
        storeDiscountFromPreview: previewStoreDiscount,
        voucherDiscount: previewData.overallDiscount, // Tổng discount từ API (platform + store)
        shippingFee: previewData.overallShipping,
        total: calculatedTotal,
      };
    }

    // Fallback: tính toán thủ công nếu chưa có preview data
    if (!cart || cartItems.length === 0) {
      return {
        subtotalBeforePlatformDiscount: 0,
        subtotalAfterPlatformDiscount: 0,
        totalPlatformDiscount: 0,
        shopVoucherDiscount: 0,
        productVoucherDiscount: 0,
        storeDiscount: 0,
        platformDiscount: 0,
        storeDiscountFromPreview: 0,
        voucherDiscount: 0,
        shippingFee: 0,
        total: 0,
      };
    }

    const subtotalBeforePlatformDiscount = cartItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity,
      0,
    );
    const subtotalAfterPlatformDiscount = cartItems.reduce(
      (sum, item) => sum + item.finalPrice * item.quantity,
      0,
    );
    const totalPlatformDiscount = Math.max(
      0,
      subtotalBeforePlatformDiscount - subtotalAfterPlatformDiscount,
    );

    // Tính shop voucher discount từ selectedShopVouchers (giống CartScreen)
    let shopVoucherDiscount = 0;
    selectedShopVouchers.forEach((voucherInfo, storeId) => {
      const vouchers = storeVouchers.get(storeId) || [];
      const voucher = vouchers.find(
        (v: ShopVoucherFromAPI) => (v.shopVoucherId || v.voucherId) === voucherInfo.shopVoucherId,
      );
      if (!voucher || !isVoucherActive(voucher)) {
        return;
      }

      const storeItems = cartItems.filter((item) => {
        if (item.type !== 'PRODUCT') return false;
        const cache = productCache[item.refId];
        return cache?.storeId === storeId;
      });

      if (storeItems.length === 0) {
        return;
      }

      const storeSubtotal = storeItems.reduce(
        (sum, item) => sum + item.finalPrice * item.quantity,
        0,
      );

      const storeBaseSubtotal = storeItems.reduce(
        (sum, item) => sum + (item.originalPrice ?? item.finalPrice) * item.quantity,
        0,
      );

      if (voucher.minOrderValue && storeBaseSubtotal < voucher.minOrderValue) {
        return;
      }

      let storeDiscount = 0;
      if (voucher.discountPercent !== null && voucher.discountPercent !== undefined && voucher.discountPercent > 0) {
        const discount = (storeSubtotal * voucher.discountPercent) / 100;
        storeDiscount = voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
          ? Math.min(discount, voucher.maxDiscountValue)
          : discount;
      } else if (voucher.discountValue !== null && voucher.discountValue !== undefined && voucher.discountValue > 0) {
        storeDiscount = voucher.discountValue;
      }

      shopVoucherDiscount += Math.round(storeDiscount);
    });

    // Tính product voucher discount từ selectedProductVouchers (giống CartScreen)
    let productVoucherDiscount = 0;
    selectedProductVouchers.forEach((voucherInfo, cartItemId) => {
      const vouchers = productVouchers.get(cartItemId) || [];
      const voucher = vouchers.find(
        (v: ShopVoucherFromAPI) => (v.shopVoucherId || v.voucherId) === voucherInfo.shopVoucherId,
      );
      if (!voucher || !isVoucherActive(voucher)) {
        return;
      }

      const item = cartItems.find((it) => it.cartItemId === cartItemId);
      if (!item) return;

      const priceForVoucherCalculation = 
        item.inPlatformCampaign &&
        !item.campaignUsageExceeded &&
        item.platformCampaignPrice !== null &&
        item.platformCampaignPrice !== undefined
          ? item.platformCampaignPrice
          : (item.originalPrice ?? item.finalPrice);

      const itemSubtotal = priceForVoucherCalculation * item.quantity;

      if (voucher.minOrderValue && itemSubtotal < voucher.minOrderValue) {
        return;
      }

      let itemDiscount = 0;
      if (voucher.discountPercent !== null && voucher.discountPercent !== undefined && voucher.discountPercent > 0) {
        const discount = (itemSubtotal * voucher.discountPercent) / 100;
        itemDiscount = voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
          ? Math.min(discount, voucher.maxDiscountValue)
          : discount;
      } else if (voucher.discountValue !== null && voucher.discountValue !== undefined && voucher.discountValue > 0) {
        itemDiscount = voucher.discountValue;
      }

      productVoucherDiscount += Math.round(itemDiscount);
    });

    const totalStoreDiscount = shopVoucherDiscount + productVoucherDiscount;
    const voucherDiscount = totalStoreDiscount;

    const total = Math.max(
      0,
      Math.round(
        subtotalAfterPlatformDiscount - shopVoucherDiscount - productVoucherDiscount + shippingFee,
      ),
    );

    return {
      subtotalBeforePlatformDiscount,
      subtotalAfterPlatformDiscount,
      totalPlatformDiscount,
      shopVoucherDiscount,
      productVoucherDiscount,
      storeDiscount: totalStoreDiscount,
      platformDiscount: 0, // Không có preview data, không có giá trị từ backend
      storeDiscountFromPreview: 0, // Không có preview data, không có giá trị từ backend
      voucherDiscount,
      shippingFee,
      total,
    };
  }, [
    previewData,
    cart,
    cartItems,
    selectedShopVouchers,
    selectedProductVouchers,
    storeVouchers,
    productVouchers,
    productCache,
    isVoucherActive,
    shippingFee,
  ]);
  
  // Debug: Log để kiểm tra (chỉ log khi cần thiết, không log thường xuyên)
  // useEffect(() => {
  //   if (previewData) {
  //     console.log('[CheckoutScreen] Pricing from preview data:', {
  //       previewPlatformDiscount: previewData.stores.reduce((sum, s) => sum + (s.platformDiscount || 0), 0),
  //       previewStoreDiscount: previewData.stores.reduce((sum, s) => sum + (s.storeDiscount || 0), 0),
  //       calculatedPlatformDiscount: pricing.totalPlatformDiscount,
  //       calculatedStoreDiscount: pricing.storeDiscount,
  //       hasCartItems: cartItems.length > 0,
  //     });
  //   }
  // }, [previewData, pricing.totalPlatformDiscount, pricing.storeDiscount, cartItems.length]);
  
  // Debug: Log pricing để kiểm tra storeDiscount (chỉ log khi cần thiết, không log thường xuyên)
  // useEffect(() => {
  //   console.log('[CheckoutScreen] Pricing calculated:', {
  //     subtotalBeforePlatformDiscount: pricing.subtotalBeforePlatformDiscount,
  //     totalPlatformDiscount: pricing.totalPlatformDiscount,
  //     storeDiscount: pricing.storeDiscount,
  //     shippingFee: pricing.shippingFee,
  //     total: pricing.total,
  //     hasPreviewData: !!previewData,
  //     previewDataStores: previewData ? previewData.stores.map(s => ({
  //       storeId: s.storeId,
  //       storeName: s.storeName,
  //       platformDiscount: s.platformDiscount,
  //       storeDiscount: s.storeDiscount,
  //       subtotal: s.subtotal,
  //       shippingFee: s.shippingFee,
  //       grandTotal: s.grandTotal,
  //     })) : null,
  //     previewOverallSubtotal: previewData?.overallSubtotal,
  //     previewOverallShipping: previewData?.overallShipping,
  //     previewOverallDiscount: previewData?.overallDiscount,
  //     previewOverallGrandTotal: previewData?.overallGrandTotal,
  //     appliedStoreVouchersCount: Object.keys(appliedStoreVouchers).length,
  //     appliedStoreWideVouchersCount: Object.keys(appliedStoreWideVouchers).length,
  //   });
  // }, [pricing, previewData, appliedStoreVouchers, appliedStoreWideVouchers]);

  // Build preview payload for checkout preview API
  const buildPreviewPayload = useCallback((): CheckoutPreviewRequest | null => {
    if (!cart || cartItems.length === 0) {
      return null;
    }

    // Build items
    const items: CheckoutPreviewRequest['items'] = cartItems.map((item) => {
      const baseItem: CheckoutPreviewRequest['items'][0] = {
        type: 'PRODUCT',
        quantity: item.quantity,
      };

      // Check if item is COMBO
      const isCombo = item.type === 'COMBO';
      if (isCombo) {
        baseItem.type = 'COMBO';
        baseItem.comboId = item.refId;
        return baseItem;
      }

      // PRODUCT
      if (item.variantId !== null && item.variantId !== undefined) {
        baseItem.variantId = item.variantId;
      } else {
        baseItem.productId = item.refId;
      }
      return baseItem;
    });

    // Build merged store vouchers (merge shop + product vouchers)
    // Theo tài liệu: Shop vouchers và Product vouchers được merge thành store vouchers format
    // Format: Array<{ storeId: string, codes: string[] }>
    // Lưu ý: Backend yêu cầu codes (string array), không phải shopVoucherId
    const storeVouchersMap: Record<string, string[]> = {};
    
    // 1. Thêm shop vouchers từ selectedShopVouchers (ALL_SHOP_VOUCHER scope)
    selectedShopVouchers.forEach((voucherInfo, storeId) => {
      if (!storeVouchersMap[storeId]) {
        storeVouchersMap[storeId] = [];
      }
      // Chỉ thêm code, không thêm shopVoucherId (backend yêu cầu codes)
      if (!storeVouchersMap[storeId].includes(voucherInfo.code)) {
        storeVouchersMap[storeId].push(voucherInfo.code);
      }
    });
    
    // 2. Thêm product vouchers (PRODUCT_VOUCHER scope) - convert cartItemId -> storeId
    selectedProductVouchers.forEach((voucherInfo, cartItemId) => {
      const item = cartItems.find((it) => it.cartItemId === cartItemId);
      if (!item || item.type !== 'PRODUCT') return;
      
      const product = productCache[item.refId];
      if (!product?.storeId) return;
      
      const storeId = product.storeId;
      if (!storeVouchersMap[storeId]) {
        storeVouchersMap[storeId] = [];
      }
      // Chỉ thêm code, không thêm shopVoucherId (backend yêu cầu codes)
      if (!storeVouchersMap[storeId].includes(voucherInfo.code)) {
        storeVouchersMap[storeId].push(voucherInfo.code);
      }
    });
    
    // 3. Legacy fallback: Thêm từ appliedStoreVouchers và appliedStoreWideVouchers (backward compatibility)
    // Chỉ dùng nếu selectedShopVouchers và selectedProductVouchers trống
    if (selectedShopVouchers.size === 0 && selectedProductVouchers.size === 0) {
      Object.values(appliedStoreVouchers).forEach((v) => {
        if (v.storeId && v.code) {
          if (!storeVouchersMap[v.storeId]) {
            storeVouchersMap[v.storeId] = [];
          }
          if (!storeVouchersMap[v.storeId].includes(v.code)) {
            storeVouchersMap[v.storeId].push(v.code);
          }
        }
      });
      Object.values(appliedStoreWideVouchers).forEach((v) => {
        if (v.storeId && v.code) {
          if (!storeVouchersMap[v.storeId]) {
            storeVouchersMap[v.storeId] = [];
          }
          if (!storeVouchersMap[v.storeId].includes(v.code)) {
            storeVouchersMap[v.storeId].push(v.code);
          }
        }
      });
    }

    const storeVouchers = Object.entries(storeVouchersMap)
      .filter(([_, codes]) => codes.length > 0)
      .map(([storeId, codes]) => ({
        storeId,
        codes,
      }));

    // Build platform vouchers (group by campaignProductId)
    // Logic: Lấy từ items đang trong platform campaign và chưa hết quota
    const platformVouchersMap: Record<string, number> = {};
    
    cartItems.forEach((item) => {
      // Chỉ tính items đang trong platform campaign và chưa hết quota
      if (
        item.type === 'PRODUCT' &&
        item.inPlatformCampaign &&
        !item.campaignUsageExceeded
      ) {
        const productId = item.refId;
        const platformDiscount = platformVoucherDiscounts[productId];
        
        if (platformDiscount?.campaignProductId) {
          const key = platformDiscount.campaignProductId;
          // Sử dụng campaignRemaining nếu có, ngược lại dùng quantity
          const usable = typeof item.campaignRemaining === 'number'
            ? Math.min(item.quantity, item.campaignRemaining)
            : item.quantity;
          
          if (usable > 0) {
            platformVouchersMap[key] = (platformVouchersMap[key] || 0) + usable;
          }
        }
      }
    });

    const platformVouchers = Object.entries(platformVouchersMap)
      .filter(([_, quantity]) => quantity > 0)
      .map(([campaignProductId, quantity]) => ({
        campaignProductId,
        quantity,
      }));

    // Calculate serviceTypeIds for each store
    const serviceTypeIds: Record<string, number> = {};
    const itemsByStore: Record<string, typeof cartItems> = {};
    cartItems.forEach((item) => {
      const cache = productCache[item.refId];
      if (!cache?.storeId) return;
      const storeId = cache.storeId;
      if (!itemsByStore[storeId]) {
        itemsByStore[storeId] = [];
      }
      itemsByStore[storeId].push(item);
    });
    Object.keys(itemsByStore).forEach((storeId) => {
      const storeItems = itemsByStore[storeId];
      serviceTypeIds[storeId] = calculateServiceType(storeItems, productCache);
    });

    // Lấy message từ address.note nếu có
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    const message = selectedAddress?.note || null;

    return {
      items,
      addressId: selectedAddressId || null,
      message,
      storeVouchers: storeVouchers.length > 0 ? storeVouchers : null,
      platformVouchers: platformVouchers.length > 0 ? platformVouchers : null,
      serviceTypeIds: Object.keys(serviceTypeIds).length > 0 ? serviceTypeIds : null,
    };
  }, [
    cart?.cartId, // Chỉ track cartId thay vì toàn bộ cart object
    cartItems.length, // Chỉ track length
    selectedAddressId,
    addresses, // Cần addresses để lấy message từ address.note
    // Serialize keys để so sánh thay vì reference
    JSON.stringify(Array.from(selectedShopVouchers.keys()).sort()),
    JSON.stringify(Array.from(selectedProductVouchers.keys()).sort()),
    JSON.stringify(Object.keys(appliedStoreVouchers).sort()),
    JSON.stringify(Object.keys(appliedStoreWideVouchers).sort()),
    JSON.stringify(Object.keys(platformVoucherDiscounts).sort()),
    JSON.stringify(Object.keys(productCache).sort()),
    productCache, // Cần productCache để convert cartItemId -> storeId
  ]);

  // Load checkout preview data - chỉ gọi khi thực sự cần thiết
  // Điều kiện: phải có selectedAddressId, cart, cartItems, và đầy đủ productCache
  useEffect(() => {
    // Điều kiện 1: Phải có địa chỉ
    if (!selectedAddressId) {
      setPreviewData(null);
      setPreviewError(null);
      return;
    }
    
    // Điều kiện 2: Phải có cart và items
    if (!cart || cartItems.length === 0) {
      setPreviewData(null);
      setPreviewError(null);
      return;
    }

    // Điều kiện 3: Phải có đầy đủ product cache (để build serviceTypeIds)
    const missingProductCache = cartItems.some(
      (item) => item.type === 'PRODUCT' && !productCache[item.refId],
    );
    if (missingProductCache) {
      // Chưa có đầy đủ product cache, chờ load xong
      return;
    }

    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;
    if (!customerId || !accessToken) {
      return;
    }

    // Throttle: chỉ gọi nếu đã qua 3 giây kể từ lần gọi trước
    const now = Date.now();
    const timeSinceLastCall = now - lastPreviewCallRef.current;
    if (timeSinceLastCall < PREVIEW_THROTTLE_MS) {
      // Chưa đủ thời gian, bỏ qua
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsLoadingPreview(true);
        setPreviewError(null);

        const payload = buildPreviewPayload();
        if (!payload) {
          setPreviewData(null);
          setIsLoadingPreview(false);
          return;
        }

        // Update last call time
        lastPreviewCallRef.current = Date.now();

        const preview = await checkoutPreview({ customerId, accessToken, payload });
        
        setPreviewData(preview);

        // Update shipping fee from preview
        setShippingFee(preview.overallShipping);
        
        // Update store shipping fees and names from preview
        const storeFeesMap: Record<string, number> = {};
        const storeNamesMap: Record<string, string> = {};
        preview.stores.forEach((store) => {
          storeFeesMap[store.storeId] = store.shippingFee || 0;
          storeNamesMap[store.storeId] = store.storeName;
        });
        setStoreShippingFees(storeFeesMap);
        setStoreNames(storeNamesMap);
      } catch (error: any) {
        console.error('[CheckoutScreen] checkoutPreview: Failed', error);
        const message =
          error?.response?.data?.message || 'Không thể tải thông tin checkout. Vui lòng thử lại.';
        setPreviewError(message);
        setPreviewData(null);
      } finally {
        setIsLoadingPreview(false);
      }
    }, 2000); // Debounce 2 seconds

    return () => clearTimeout(timeoutId);
  }, [
    selectedAddressId,
    cart?.cartId,
    cartItems.length,
    // Thêm dependencies để trigger khi vouchers hoặc productCache thay đổi
    // Serialize keys để so sánh thay vì reference
    JSON.stringify(Array.from(selectedShopVouchers.keys()).sort()),
    JSON.stringify(Array.from(selectedProductVouchers.keys()).sort()),
    JSON.stringify(Object.keys(productCache).sort()),
    // Không thêm productCache vào dependencies vì đã serialize keys
    // Không thêm buildPreviewPayload vào dependencies để tránh infinite loop
    authState.decodedToken?.customerId,
    authState.accessToken,
  ]);

  // Build checkout payload with proper COMBO and variantId handling
  const buildCheckoutPayload = useCallback(async () => {
    if (!selectedAddressId || !cart) {
      // log.log('[CheckoutScreen] buildCheckoutPayload: Skipped - No address or cart');
      return null;
    }

    // log.log('[CheckoutScreen] buildCheckoutPayload: Building payload...', {
    //   itemsCount: cartItems.length,
    //   addressId: selectedAddressId,
    // });

    // Step 1: Build checkout items payload
    const items: CheckoutItemPayload[] = cartItems.map((item) => {
      const basePayload: CheckoutItemPayload = {
        type: 'PRODUCT',
        quantity: item.quantity,
      };

      // Check if item is COMBO
      const isCombo = item.type === 'COMBO';

      if (isCombo) {
        // COMBO: Gửi comboId = refId (productId)
        basePayload.type = 'COMBO';
        basePayload.comboId = item.refId;
        return basePayload;
      }

      // PRODUCT
      if (item.variantId !== null && item.variantId !== undefined) {
        // Có variantId → gửi variantId, KHÔNG gửi productId
        basePayload.variantId = item.variantId;
        return basePayload;
      }

      // Không có variantId → gửi productId, KHÔNG gửi variantId
      basePayload.productId = item.refId;
      return basePayload;
    });

    // Step 2: Build merged store vouchers (merge shop + product vouchers)
    // Format: [{ storeId: "...", codes: ["code1", "code2"] }]
    // Lưu ý: Backend yêu cầu codes (string array), không phải shopVoucherId
    const storeVouchersMap: Record<string, string[]> = {};
    
    // 1. Thêm shop vouchers từ selectedShopVouchers (ALL_SHOP_VOUCHER scope)
    selectedShopVouchers.forEach((voucherInfo, storeId) => {
      if (!storeVouchersMap[storeId]) {
        storeVouchersMap[storeId] = [];
      }
      // Chỉ thêm code, không thêm shopVoucherId (backend yêu cầu codes)
      if (!storeVouchersMap[storeId].includes(voucherInfo.code)) {
        storeVouchersMap[storeId].push(voucherInfo.code);
      }
    });
    
    // 2. Thêm product vouchers (PRODUCT_VOUCHER scope) - convert cartItemId -> storeId
    selectedProductVouchers.forEach((voucherInfo, cartItemId) => {
      const item = cartItems.find((it) => it.cartItemId === cartItemId);
      if (!item || item.type !== 'PRODUCT') return;
      
      const product = productCache[item.refId];
      if (!product?.storeId) return;
      
      const storeId = product.storeId;
      if (!storeVouchersMap[storeId]) {
        storeVouchersMap[storeId] = [];
      }
      // Chỉ thêm code, không thêm shopVoucherId (backend yêu cầu codes)
      if (!storeVouchersMap[storeId].includes(voucherInfo.code)) {
        storeVouchersMap[storeId].push(voucherInfo.code);
      }
    });
    
    // 3. Legacy fallback: Thêm từ appliedStoreVouchers và appliedStoreWideVouchers (backward compatibility)
    // Chỉ dùng nếu selectedShopVouchers và selectedProductVouchers trống
    if (selectedShopVouchers.size === 0 && selectedProductVouchers.size === 0) {
      Object.values(appliedStoreVouchers).forEach((v) => {
        if (v.storeId && v.code) {
          if (!storeVouchersMap[v.storeId]) {
            storeVouchersMap[v.storeId] = [];
          }
          if (!storeVouchersMap[v.storeId].includes(v.code)) {
            storeVouchersMap[v.storeId].push(v.code);
          }
        }
      });
      Object.values(appliedStoreWideVouchers).forEach((v) => {
        if (v.storeId && v.code) {
          if (!storeVouchersMap[v.storeId]) {
            storeVouchersMap[v.storeId] = [];
          }
          if (!storeVouchersMap[v.storeId].includes(v.code)) {
            storeVouchersMap[v.storeId].push(v.code);
          }
        }
      });
    }
    
    const storeVouchers = Object.entries(storeVouchersMap)
      .filter(([_, codes]) => codes.length > 0)
      .map(([storeId, codes]) => ({
        storeId,
        codes,
      }));

    // Step 3: Calculate serviceTypeId for each store
    const serviceTypeIds: Record<string, number> = {};
    const itemsByStore: Record<string, typeof cartItems> = {};
    
    // Group items by store
    cartItems.forEach((item) => {
      const cache = productCache[item.refId];
      if (!cache?.storeId) return;
      const storeId = cache.storeId;
      if (!itemsByStore[storeId]) {
        itemsByStore[storeId] = [];
      }
      itemsByStore[storeId].push(item);
    });

    // Calculate serviceTypeId for each store
    Object.keys(itemsByStore).forEach((storeId) => {
      const storeItems = itemsByStore[storeId];
      serviceTypeIds[storeId] = calculateServiceType(storeItems, productCache);
    });

    // Step 4: Build platform vouchers (fetch missing if needed, group by campaignProductId)
    // Check for missing platform vouchers (for variants)
    const missingProductIds = new Set<string>();
    items.forEach((item) => {
      if (item.variantId && !item.productId) {
        // Có variantId nhưng không có productId trong payload
        // Cần tìm productId từ cartItems
        const cartItem = cartItems.find((ci) => ci.variantId === item.variantId);
        if (cartItem && !platformVoucherDiscounts[cartItem.refId]) {
          missingProductIds.add(cartItem.refId);
        }
      } else if (item.productId && !platformVoucherDiscounts[item.productId]) {
        missingProductIds.add(item.productId);
      }
    });

    // Fetch missing platform vouchers
    let finalPlatformVoucherDiscounts = { ...platformVoucherDiscounts };
    if (missingProductIds.size > 0) {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (customerId && accessToken) {
        const voucherPromises = Array.from(missingProductIds).map(async (productId) => {
          try {
            const voucherRes = await getProductVouchers(productId);
            const now = new Date();
            
            // Ưu tiên: platformVouchers (cấu trúc mới)
            // Fallback: platform (legacy)
            const platformVouchers = voucherRes?.vouchers?.platformVouchers || [];
            const platformCampaigns = voucherRes?.vouchers?.platform || [];
            
            let platformDiscount = 0;
            let campaignProductId: string | null = null;
            let platformVoucherId: string | undefined = undefined;
            let activeCampaign: PlatformCampaign | null = null;
            let activeVoucher: PlatformVoucherItem | null = null;

            // Tìm trong platformVouchers trước (cấu trúc mới)
            if (platformVouchers.length > 0) {
              for (const campaign of platformVouchers) {
                if (campaign.status === 'ACTIVE' && campaign.vouchers && campaign.vouchers.length > 0) {
                  const start = campaign.startTime ? new Date(campaign.startTime) : null;
                  const end = campaign.endTime ? new Date(campaign.endTime) : null;
                  if ((!start || start <= now) && (!end || end >= now)) {
                    const voucher = campaign.vouchers.find((v: PlatformVoucherItem) => {
                      if (!v) return false;
                      const vStart = v.startTime ? new Date(v.startTime) : null;
                      const vEnd = v.endTime ? new Date(v.endTime) : null;
                      return (v.status === 'ACTIVE' || !v.status) && (!vStart || vStart <= now) && (!vEnd || vEnd >= now);
                    });
                    if (voucher) {
                      activeCampaign = campaign as any;
                      activeVoucher = voucher;
                      break;
                    }
                  }
                }
              }
            }
            
            // Fallback: Tìm trong platformCampaigns (legacy)
            if (!activeVoucher && platformCampaigns.length > 0) {
              activeCampaign = platformCampaigns.find((c: PlatformCampaign) => {
                if (!c || c.status !== 'ACTIVE') return false;
                const start = c.startTime ? new Date(c.startTime) : null;
                const end = c.endTime ? new Date(c.endTime) : null;
                return (!start || start <= now) && (!end || end >= now);
              }) || null;

              if (activeCampaign) {
                activeVoucher = activeCampaign.vouchers?.find((v: PlatformVoucherItem) => {
                  if (!v) return false;
                  const start = v.startTime ? new Date(v.startTime) : null;
                  const end = v.endTime ? new Date(v.endTime) : null;
                  return (v.status === 'ACTIVE' || !v.status) && (!start || start <= now) && (!end || end >= now);
                }) || null;
              }
            }

            if (activeVoucher) {
              // Ưu tiên: platformVoucherId, fallback: campaignId
              platformVoucherId = activeVoucher.platformVoucherId;
              campaignProductId = platformVoucherId || activeCampaign?.campaignId || '';

              // Tính discount
              const productData = await getProductById(productId).catch(() => null);
              const basePrice = productData?.price || 0;

              if (activeVoucher.type === 'FIXED' && activeVoucher.discountValue) {
                platformDiscount = activeVoucher.discountValue;
              } else if (activeVoucher.type === 'PERCENT' && activeVoucher.discountPercent) {
                const percentDiscount = (basePrice * activeVoucher.discountPercent) / 100;
                platformDiscount = activeVoucher.maxDiscountValue
                  ? Math.min(percentDiscount, activeVoucher.maxDiscountValue)
                  : percentDiscount;
              }
            }

            if (campaignProductId && platformDiscount > 0) {
              return { productId, discount: platformDiscount, campaignProductId, platformVoucherId };
            }
            return null;
          } catch (error) {
            return null;
          }
        });

        const results = await Promise.all(voucherPromises);
        results.forEach((result) => {
          if (result) {
            finalPlatformVoucherDiscounts[result.productId] = {
              discount: result.discount,
              campaignProductId: result.campaignProductId,
              inPlatformCampaign: true,
              platformVoucherId: result.platformVoucherId,
            };
          }
        });
      }
    }

    // Build platform vouchers map (gom theo campaignProductId)
    // Logic: Lấy từ items đang trong platform campaign và chưa hết quota
    const platformVouchersMap: Record<string, { campaignProductId: string; quantity: number; platformVoucherId?: string }> = {};

    cartItems.forEach((item) => {
      // Chỉ tính items đang trong platform campaign và chưa hết quota
      if (
        item.type === 'PRODUCT' &&
        item.inPlatformCampaign &&
        !item.campaignUsageExceeded
      ) {
        const productId = item.refId;
        const platformDiscount = finalPlatformVoucherDiscounts[productId];

        if (platformDiscount?.campaignProductId) {
          const key = platformDiscount.campaignProductId;
          // Sử dụng campaignRemaining nếu có, ngược lại dùng quantity
          const usable = typeof item.campaignRemaining === 'number'
            ? Math.min(item.quantity, item.campaignRemaining)
            : item.quantity;
          
          if (usable > 0) {
            if (!platformVouchersMap[key]) {
              platformVouchersMap[key] = {
                campaignProductId: platformDiscount.campaignProductId,
                quantity: 0,
                platformVoucherId: platformDiscount.platformVoucherId,
              };
            }
            platformVouchersMap[key].quantity += usable;
          }
        }
      }
    });

    const platformVouchers = Object.values(platformVouchersMap)
      .filter((v) => v.campaignProductId && v.quantity > 0)
      .map((v) => ({
        campaignProductId: v.campaignProductId,
        quantity: v.quantity,
      }));

    // Lấy message từ address.note nếu có
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    const message = selectedAddress?.note || null;

    const payload = {
      items,
      addressId: selectedAddressId,
      message,
      storeVouchers: storeVouchers.length > 0 ? storeVouchers : undefined,
      platformVouchers: platformVouchers.length > 0 ? platformVouchers : undefined,
      serviceTypeIds: Object.keys(serviceTypeIds).length > 0 ? serviceTypeIds : undefined,
    };

    // log.log('[CheckoutScreen] buildCheckoutPayload: Payload built', {
    //   itemsCount: items.length,
    //   storeVouchersCount: storeVouchers.length,
    //   platformVouchersCount: platformVouchers.length,
    //   serviceTypeIdsCount: Object.keys(serviceTypeIds).length,
    //   payload: {
    //     ...payload,
    //     items: items.map((i) => ({
    //       type: i.type,
    //       quantity: i.quantity,
    //       hasVariant: !!i.variantId,
    //       hasProduct: !!i.productId,
    //       hasCombo: !!i.comboId,
    //     })),
    //   },
    // });

    return payload;
  }, [
    selectedAddressId,
    cart,
    cartItems,
    selectedShopVouchers,
    selectedProductVouchers,
    appliedStoreVouchers,
    appliedStoreWideVouchers,
    productCache,
    platformVoucherDiscounts,
    addresses,
    authState.decodedToken?.customerId,
    authState.accessToken,
  ]);

  // Handle checkout with validation
  const handleCheckout = useCallback(async () => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;
    if (!customerId || !accessToken) {
      // log.log('[CheckoutScreen] handleCheckout: Skipped - No customerId or accessToken');
      setSnackbarMessage('Vui lòng đăng nhập để tiếp tục');
      setSnackbarVisible(true);
      return;
    }

    // log.log('[CheckoutScreen] handleCheckout: Starting...', {
    //   paymentMethod,
    //   customerId,
    // });

    // Step 1: Validation
    if (cartItems.length === 0) {
      // log.log('[CheckoutScreen] handleCheckout: Validation failed - Empty cart');
      setSnackbarMessage('Giỏ hàng của bạn đang trống.');
      setSnackbarVisible(true);
      return;
    }

    if (!selectedAddressId) {
      // log.log('[CheckoutScreen] handleCheckout: Validation failed - No address');
      setSnackbarMessage('Vui lòng chọn địa chỉ nhận hàng.');
      setSnackbarVisible(true);
      return;
    }

    // Chỉ sử dụng COD, không cần validation payment method

    if (shippingFeeError) {
      // log.log('[CheckoutScreen] handleCheckout: Validation failed - Shipping fee error');
      setSnackbarMessage('Không thể tính phí vận chuyển. Vui lòng kiểm tra lại địa chỉ.');
      setSnackbarVisible(true);
      return;
    }

    // log.log('[CheckoutScreen] handleCheckout: Validation passed');

    // Step 2: Build payload (async)
    const payload = await buildCheckoutPayload();
    if (!payload) {
      // log.log('[CheckoutScreen] handleCheckout: Failed - No payload');
      setSnackbarMessage('Vui lòng chọn địa chỉ giao hàng');
      setSnackbarVisible(true);
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Chỉ sử dụng COD
      const result = await checkoutCod({ customerId, accessToken, payload });
      
      // Response là array của orders
      if (result && Array.isArray(result) && result.length > 0) {
        const firstOrder = result[0];

        // Success handling - Clear AsyncStorage
        try {
          await AsyncStorage.removeItem(CHECKOUT_SESSION_KEY);
          log.log('[CheckoutScreen] handleCheckout: Cleared checkout session storage');
        } catch (storageError) {
          log.error('[CheckoutScreen] handleCheckout: Failed to clear storage', storageError);
        }

        setSnackbarMessage(`Đặt hàng thành công! Mã đơn: ${firstOrder.orderCode}`);
        setSnackbarVisible(true);

        // Navigate to Profile (orders screen)
        setTimeout(() => {
          // @ts-ignore
          navigation.navigate('Profile');
        }, 2000);
      } else {
        setSnackbarMessage('Đặt hàng thành công nhưng không nhận được thông tin đơn hàng.');
        setSnackbarVisible(true);
      }
    } catch (error: any) {
      // Xử lý lỗi theo tài liệu API
      const status = error?.response?.status;
      const errorData = error?.response?.data;
      let errorMessage = 'Không thể đặt hàng. Vui lòng thử lại.';

      if (status === 400) {
        // Bad Request - có thể là validation error
        errorMessage = errorData?.message || 'Thông tin đơn hàng không hợp lệ. Vui lòng kiểm tra lại.';
      } else if (status === 404) {
        // Not Found - có thể là sản phẩm hết hàng hoặc địa chỉ không tồn tại
        if (errorData?.message?.includes('product') || errorData?.message?.includes('sản phẩm')) {
          errorMessage = 'Một số sản phẩm đã hết hàng. Vui lòng quay lại giỏ hàng.';
        } else if (errorData?.message?.includes('address') || errorData?.message?.includes('địa chỉ')) {
          errorMessage = 'Địa chỉ nhận hàng không hợp lệ. Vui lòng chọn lại địa chỉ.';
        } else {
          errorMessage = errorData?.message || 'Không tìm thấy thông tin. Vui lòng thử lại.';
        }
      } else if (status === 409) {
        // Conflict - có thể là không đủ số lượng
        if (errorData?.message?.includes('quantity') || errorData?.message?.includes('số lượng')) {
          errorMessage = 'Số lượng sản phẩm vượt quá tồn kho. Vui lòng giảm số lượng.';
        } else {
          errorMessage = errorData?.message || 'Sản phẩm không đủ số lượng. Vui lòng kiểm tra lại.';
        }
      } else if (status === 422) {
        // Unprocessable Entity - có thể là voucher không hợp lệ
        if (errorData?.message?.includes('voucher') || errorData?.message?.includes('Voucher')) {
          errorMessage = 'Voucher không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại.';
          // Có thể xóa voucher khỏi selection và reload preview ở đây
        } else {
          errorMessage = errorData?.message || 'Thông tin không hợp lệ. Vui lòng kiểm tra lại.';
        }
      } else if (status === 401) {
        // Unauthorized
        errorMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
      } else if (status === 500) {
        // Internal Server Error
        errorMessage = 'Lỗi hệ thống. Vui lòng thử lại sau.';
      } else if (error?.message?.includes('Network') || !error?.response) {
        // Network error
        errorMessage = 'Lỗi kết nối. Vui lòng kiểm tra internet và thử lại.';
      } else if (errorData?.message) {
        // Có message từ backend
        errorMessage = errorData.message;
      }

      setSnackbarMessage(errorMessage);
      setSnackbarVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    buildCheckoutPayload,
    authState.decodedToken?.customerId,
    authState.accessToken,
    navigation,
    cartItems.length,
    selectedAddressId,
    shippingFeeError,
  ]);

  // Handle remove item
  const handleRemoveItem = useCallback(
    async (cartItemId: string) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) {
        // log.log('[CheckoutScreen] handleRemoveItem: Skipped - No customerId or accessToken');
        return;
      }
      // log.log('[CheckoutScreen] handleRemoveItem: Removing item', { cartItemId });
      try {
        await deleteCartItems({ customerId, accessToken, cartItemIds: [cartItemId] });
        // log.log('[CheckoutScreen] handleRemoveItem: Item removed successfully', { cartItemId });
        await loadData();
      } catch (error: any) {
        // log.error('[CheckoutScreen] handleRemoveItem: Failed', {
        //   cartItemId,
        //   status: error?.response?.status,
        //   message: error?.response?.data?.message || error?.message,
        //   error,
        // });
        setSnackbarMessage('Không thể xóa sản phẩm. Vui lòng thử lại.');
        setSnackbarVisible(true);
      }
    },
    [authState.decodedToken?.customerId, authState.accessToken, loadData],
  );

  const renderAddressSection = () => {
    // Tìm địa chỉ mặc định hoặc địa chỉ đang được chọn
    const defaultAddress = addresses.find((a) => a.default) ?? addresses[0];
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? defaultAddress;
    const otherAddresses = addresses.filter((a) => a.id !== selectedAddress?.id);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AddressList' as never)}>
            <Text style={styles.linkText}>Quản lý</Text>
          </TouchableOpacity>
        </View>
        {addresses.length === 0 ? (
          <Text style={styles.muted}>Chưa có địa chỉ. Vui lòng thêm mới.</Text>
        ) : (
          <>
            {/* Hiển thị địa chỉ đang được chọn */}
            {selectedAddress && (
              <TouchableOpacity
                style={styles.addressRow}
                onPress={() => {
                  setSelectedAddressId(selectedAddress.id);
                }}
              >
                <RadioButton
                  value={selectedAddress.id}
                  status="checked"
                  color={ORANGE}
                  onPress={() => {
                    setSelectedAddressId(selectedAddress.id);
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressName}>{selectedAddress.receiverName}</Text>
                  <Text style={styles.addressText}>{selectedAddress.phoneNumber}</Text>
                  <Text style={styles.addressText}>
                    {selectedAddress.addressLine}, {selectedAddress.street}, {selectedAddress.ward}, {selectedAddress.district}, {selectedAddress.province}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Dropdown để hiển thị các địa chỉ khác */}
            {otherAddresses.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowAddressDropdown(!showAddressDropdown)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dropdownButtonText}>
                    {showAddressDropdown ? 'Ẩn địa chỉ khác' : `Xem thêm ${otherAddresses.length} địa chỉ khác`}
                  </Text>
                  <MaterialCommunityIcons
                    name={showAddressDropdown ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={ORANGE}
                  />
                </TouchableOpacity>

                {showAddressDropdown && (
                  <View style={styles.dropdownContainer}>
                    {otherAddresses.map((addr) => (
                      <TouchableOpacity
                        key={addr.id}
                        style={styles.addressRow}
                        onPress={() => {
                          setSelectedAddressId(addr.id);
                          setShowAddressDropdown(false);
                        }}
                      >
                        <RadioButton
                          value={addr.id}
                          status={selectedAddressId === addr.id ? 'checked' : 'unchecked'}
                          color={ORANGE}
                          onPress={() => {
                            setSelectedAddressId(addr.id);
                            setShowAddressDropdown(false);
                          }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.addressName}>{addr.receiverName}</Text>
                          <Text style={styles.addressText}>{addr.phoneNumber}</Text>
                          <Text style={styles.addressText}>
                            {addr.addressLine}, {addr.street}, {addr.ward}, {addr.district}, {addr.province}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>
    );
  };

  const renderItems = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sản phẩm</Text>
      {cartItems.map((item) => {
        const hasDiscount = item.finalPrice < item.originalPrice;
        return (
          <View key={item.cartItemId} style={styles.itemRow}>
            {item.image && (
              <Image
                source={{ uri: item.image }}
                style={styles.itemImage}
                resizeMode="contain"
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.name}
              </Text>
              {item.variantOptionValue && (
                <Text style={styles.variantText}>{item.variantOptionValue}</Text>
              )}
              <View style={styles.priceRow}>
                <Text style={[styles.price, hasDiscount && styles.priceDiscount]}>
                  {formatCurrencyVND(item.finalPrice)}
                </Text>
                {hasDiscount && (
                  <Text style={styles.priceOriginal}>{formatCurrencyVND(item.originalPrice)}</Text>
                )}
              </View>
              <Text style={styles.quantityText}>Số lượng: {item.quantity}</Text>
            </View>
            <TouchableOpacity
              style={styles.removeItemButton}
              onPress={() => handleRemoveItem(item.cartItemId)}
            >
              <MaterialCommunityIcons name="delete-outline" size={20} color="#B3261E" />
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );

  const renderPaymentSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
      <View style={styles.paymentRow}>
        <MaterialCommunityIcons name="cash-multiple" size={24} color={ORANGE} />
        <Text style={styles.paymentLabel}>Thanh toán khi nhận hàng (COD)</Text>
      </View>
    </View>
  );

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading && !cart) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.loaderText}>Đang tải dữ liệu...</Text>
      </View>
    );
  }

  if (errorMessage && !cart) {
    return (
      <View style={styles.loaderContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#B3261E" />
        <Text style={styles.loaderText}>{errorMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thanh toán</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 16 }}>
        {renderAddressSection()}
        {renderItems()}
        {renderPaymentSection()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Giá gốc</Text>
            <Text style={styles.summaryValue}>
              {formatCurrencyVND(pricing.subtotalBeforePlatformDiscount)}
            </Text>
          </View>
          {pricing.totalPlatformDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm nền tảng</Text>
              <Text style={[styles.summaryValue, styles.summaryDiscount]}>
                -{formatCurrencyVND(pricing.totalPlatformDiscount)}
              </Text>
            </View>
          )}
          {/* Hiển thị giảm giá voucher cửa hàng (shop voucher - ALL_SHOP_VOUCHER scope) */}
          {pricing.shopVoucherDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm giá voucher cửa hàng</Text>
              <Text style={[styles.summaryValue, styles.summaryDiscount]}>
                -{formatCurrencyVND(pricing.shopVoucherDiscount)}
              </Text>
            </View>
          )}
          {/* Hiển thị giảm giá voucher sản phẩm (product voucher - PRODUCT_VOUCHER scope) */}
          {pricing.productVoucherDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm giá voucher sản phẩm</Text>
              <Text style={[styles.summaryValue, styles.summaryDiscount]}>
                -{formatCurrencyVND(pricing.productVoucherDiscount)}
              </Text>
            </View>
          )}
          {/* Hiển thị platformDiscount từ preview data */}
          {pricing.platformDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm nền tảng (từ preview)</Text>
              <Text style={[styles.summaryValue, styles.summaryDiscount]}>
                -{formatCurrencyVND(pricing.platformDiscount)}
              </Text>
            </View>
          )}
          {/* Hiển thị storeDiscount từ preview data */}
          {pricing.storeDiscountFromPreview > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm cửa hàng</Text>
              <Text style={[styles.summaryValue, styles.summaryDiscount]}>
                -{formatCurrencyVND(pricing.storeDiscountFromPreview)}
              </Text>
            </View>
          )}
           <View style={styles.summaryRow}>
             <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
             {isLoadingPreview || isCalculatingShipping ? (
               <ActivityIndicator size="small" color={ORANGE} />
             ) : pricing.shippingFee > 0 ? (
               <Text style={styles.summaryValue}>{formatCurrencyVND(pricing.shippingFee)}</Text>
             ) : (
               <Text style={styles.summaryValue}>{formatCurrencyVND(0)}</Text>
             )}
           </View>
          {(previewError || shippingFeeError) && (
            <Text style={styles.errorText}>{previewError || shippingFeeError}</Text>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatCurrencyVND(pricing.total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.totalLabelSmall}>Tổng cộng</Text>
          <Text style={styles.totalValue}>{formatCurrencyVND(pricing.total)}</Text>
        </View>
        <Button
          mode="contained"
          onPress={handleCheckout}
          style={styles.payButton}
          contentStyle={{ paddingVertical: 6 }}
          labelStyle={{ fontWeight: '700', fontSize: 16 }}
          disabled={
            !selectedAddressId ||
            !cart ||
            cart.items.length === 0 ||
            isSubmitting ||
            !!shippingFeeError
          }
          loading={isSubmitting}
        >
          Đặt hàng
        </Button>
      </View>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'Đóng',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

export default CheckoutScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: ORANGE,
  },
  backButton: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  section: {
    backgroundColor: '#FFF',
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#222' },
  linkText: { color: ORANGE, fontWeight: '700' },
  muted: { color: '#777' },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  addressName: { fontSize: 14, fontWeight: '700', color: '#222' },
  addressText: { fontSize: 13, color: '#555', marginTop: 2 },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  dropdownButtonText: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '600',
  },
  dropdownContainer: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'flex-start',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#F5F5F5',
  },
  itemName: { fontSize: 14, fontWeight: '700', color: '#222' },
  variantText: { fontSize: 13, color: '#666', marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  price: { fontSize: 15, fontWeight: '700', color: ORANGE },
  priceDiscount: { color: '#D32F2F' },
  priceOriginal: {
    fontSize: 13,
    color: '#888',
    textDecorationLine: 'line-through',
  },
  quantityText: { fontSize: 13, color: '#555', marginTop: 4 },
  removeItemButton: { padding: 4, justifyContent: 'center' },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  paymentLabel: { fontSize: 14, color: '#222', marginLeft: 8 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  summaryLabel: { color: '#666', fontSize: 14 },
  summaryValue: { color: '#222', fontSize: 14, fontWeight: '600' },
  summaryDiscount: { color: '#4CAF50' },
  summaryTotal: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#222' },
  totalLabelSmall: { fontSize: 13, color: '#666' },
  totalValue: { fontSize: 18, fontWeight: '700', color: ORANGE },
  errorText: { fontSize: 12, color: '#B3261E', marginTop: 4 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  payButton: { backgroundColor: ORANGE, borderRadius: 12, minWidth: 150 },
  loaderContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 12, color: '#555' },
});
