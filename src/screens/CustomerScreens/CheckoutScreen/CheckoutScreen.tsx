import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, RadioButton, Snackbar } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import { CustomerStackParamList } from '../../../navigation/CustomerStackNavigator';
import { checkoutCod, checkoutPayOS, deleteCartItems, getCustomerCart } from '../../../services/cartService';
import { getCustomerAddresses } from '../../../services/customerService';
import { getProductById, getProductVouchers } from '../../../services/productService';
import {
  buildGHNItems,
  calculateGHNFee,
  calculateServiceType,
  calculateTotalWeightGrams,
  ProductCacheItem,
} from '../../../services/shippingService';
import { getShopVouchersByStore } from '../../../services/voucherService';
import { Cart } from '../../../types/cart';
import { PaymentMethod } from '../../../types/checkout';
import { CustomerAddress } from '../../../types/customer';
import { PlatformCampaign, PlatformVoucherItem } from '../../../types/product';
import {
  AppliedStoreVoucher,
  AppliedStoreWideVoucher,
  PlatformVoucherDiscount,
  ShopVoucher,
} from '../../../types/voucher';

const ORANGE = '#FF6A00';

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const CheckoutScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<CustomerStackParamList, 'Checkout'>>();
  const { authState, isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Voucher states
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

  // Product cache & shipping
  const [productCache, setProductCache] = useState<Record<string, ProductCacheItem>>({});
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [storeShippingFees, setStoreShippingFees] = useState<Record<string, number>>({});
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [shippingFeeError, setShippingFeeError] = useState<string | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

  // Map cart items to UI items with pricing
  const cartItems = useMemo(() => {
    if (!cart) return [];
    return cart.items.map((item) => {
      const originalPrice = item.baseUnitPrice ?? item.unitPrice;
      const hasPlatformPrice =
        item.platformCampaignPrice !== null && item.platformCampaignPrice !== undefined;
      const finalPrice =
        item.inPlatformCampaign &&
        !item.campaignUsageExceeded &&
        hasPlatformPrice &&
        item.platformCampaignPrice
          ? item.platformCampaignPrice
          : item.unitPrice;
      return {
        ...item,
        finalPrice,
        originalPrice,
        isSelected: true, // All items in checkout are selected
      };
    });
  }, [cart]);

  // Load cart and addresses
  const loadData = useCallback(async () => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;
    if (!customerId || !accessToken) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [cartData, addressData] = await Promise.all([
        getCustomerCart({ customerId, accessToken }),
        getCustomerAddresses({ customerId, accessToken }),
      ]);
      setCart(cartData);
      setAddresses(addressData);
      if (!selectedAddressId && addressData.length > 0) {
        const defaultAddress = addressData.find((a) => a.default) ?? addressData[0];
        setSelectedAddressId(defaultAddress.id);
      }
    } catch (error: any) {
      console.error('[CheckoutScreen] loadData failed', error);
      const message =
        error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.message?.includes('Network')
          ? 'Không có kết nối mạng. Vui lòng thử lại.'
          : 'Không thể tải dữ liệu checkout. Vui lòng thử lại.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }, [authState.accessToken, authState.decodedToken?.customerId, selectedAddressId]);

  // Load vouchers for products
  useEffect(() => {
    if (!cart || cart.items.length === 0) return;
    const loadVouchers = async () => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) return;

      try {
        const uniqueProductIds = Array.from(new Set(cart.items.map((item) => item.refId)));
        const voucherPromises = uniqueProductIds.map(async (productId) => {
          try {
            const [voucherData, productData] = await Promise.all([
              getProductVouchers(productId).catch(() => null),
              getProductById(productId).catch(() => null),
            ]);

             // Update product cache
             if (productData) {
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
             }

            // Process shop vouchers
            const shopVouchers = (voucherData?.vouchers?.shop as any[]) || [];
            const shopVouchersWithStore = shopVouchers.map((v) => ({
              ...v,
              storeId: productData?.storeId,
              storeName: productData?.storeName,
            }));

            // Process platform vouchers
            const platformCampaigns = voucherData?.vouchers?.platform || [];
            const now = new Date();
            const activeCampaign = platformCampaigns.find((c: PlatformCampaign) => {
              if (!c || c.status !== 'ACTIVE') return false;
              const start = c.startTime ? new Date(c.startTime) : null;
              const end = c.endTime ? new Date(c.endTime) : null;
              return (!start || start <= now) && (!end || end >= now);
            });

            const activeVoucher = activeCampaign?.vouchers?.find((v: PlatformVoucherItem) => {
              if (!v) return false;
              const start = v.startTime ? new Date(v.startTime) : null;
              const end = v.endTime ? new Date(v.endTime) : null;
              return (v.status === 'ACTIVE' || !v.status) && (!start || start <= now) && (!end || end >= now);
            });

            let platformDiscount = 0;
            let campaignProductId = '';
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
              campaignProductId = activeCampaign?.campaignId || activeVoucher.platformVoucherId || '';
            }

            // Check if item is in platform campaign from cart
            const cartItem = cart.items.find((item) => item.refId === productId);
            const inPlatformCampaign = cartItem?.inPlatformCampaign || false;

            setPlatformVoucherDiscounts((prev) => ({
              ...prev,
              [productId]: {
                discount: platformDiscount,
                campaignProductId,
                inPlatformCampaign,
                platformVoucherId: activeVoucher?.platformVoucherId,
              },
            }));

            return shopVouchersWithStore;
          } catch (error) {
            console.error(`[CheckoutScreen] Failed to load vouchers for product ${productId}`, error);
            return [];
          }
        });

        const allShopVouchers = await Promise.all(voucherPromises);
        const flatShopVouchers = allShopVouchers.flat();
        // Dedup by code
        const uniqueVouchers = Array.from(
          new Map(flatShopVouchers.map((v) => [v.code, v])).values(),
        );
        setAvailableVouchers(uniqueVouchers);

        // Load store-wide vouchers
        const storeIds = Array.from(
          new Set(
            cart.items
              .map((item) => {
                const cache = productCache[item.refId];
                return cache?.storeId;
              })
              .filter(Boolean),
          ),
        ) as string[];

        const storeWidePromises = storeIds
          .filter((storeId) => storeId && storeId.trim() !== '')
          .map(async (storeId) => {
            try {
              const vouchers = await getShopVouchersByStore(storeId, 'ACTIVE', 'ALL_SHOP_VOUCHER');
              return { storeId, vouchers };
            } catch (error) {
              // getShopVouchersByStore already handles 404, so this is for other errors
              return { storeId, vouchers: [] };
            }
          });

        const storeWideResults = await Promise.all(storeWidePromises);
        const storeWideMap: Record<string, ShopVoucher[]> = {};
        storeWideResults.forEach(({ storeId, vouchers }) => {
          storeWideMap[storeId] = vouchers;
        });
        setStoreWideVouchers(storeWideMap);
      } catch (error) {
        console.error('[CheckoutScreen] loadVouchers failed', error);
      }
    };

    loadVouchers();
  }, [cart, authState.decodedToken?.customerId, authState.accessToken, productCache]);

  // Fetch missing product details for shipping calculation
  const fetchMissingProductDetails = useCallback(
    async (productIds: string[]) => {
      if (productIds.length === 0) return productCache;
      
      const missingIds = productIds.filter((id) => !productCache[id]);
      if (missingIds.length === 0) {
        return productCache;
      }

      try {
        const productPromises = missingIds.map(async (productId) => {
          try {
            const product = await getProductById(productId);
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
              console.error(`[CheckoutScreen] Failed to fetch product ${productId}`, error);
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

        setProductCache((prev) => ({ ...prev, ...newCache }));
        return { ...productCache, ...newCache };
      } catch (error) {
        console.error('[CheckoutScreen] fetchMissingProductDetails failed', error);
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

    // Step 2: Debounce 500ms để tránh spam API
    const timeoutId = setTimeout(async () => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) return;

      const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
      if (!selectedAddress) return;

      // Validate address
      if (!selectedAddress.provinceCode || !selectedAddress.districtId || !selectedAddress.wardCode) {
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
        if (selectedItems.length === 0) {
          setShippingFee(0);
          setStoreShippingFees({});
          setIsCalculatingShipping(false);
          return;
        }

        // Step 3: Fetch missing product details
        const productIds = Array.from(new Set(selectedItems.map((item) => item.refId)));
        const updatedCache = await fetchMissingProductDetails(productIds);
        const cacheToUse = updatedCache || productCache;

        // Step 4: Group items theo storeId
        const itemsByStore: Record<string, typeof selectedItems> = {};
        const storeNameMap: Record<string, string> = {};

        selectedItems.forEach((item) => {
          const cache = cacheToUse[item.refId];
          if (!cache?.storeId) {
            return;
          }
          const storeId = cache.storeId;
          if (!itemsByStore[storeId]) {
            itemsByStore[storeId] = [];
          }
          itemsByStore[storeId].push(item);
          storeNameMap[storeId] = cache.storeName || 'Unknown Store';
        });

        if (Object.keys(itemsByStore).length === 0) {
          setShippingFeeError('Không thể xác định cửa hàng cho các sản phẩm');
          setIsCalculatingShipping(false);
          return;
        }

        setStoreNames(storeNameMap);

        // Step 5: Với mỗi store (song song): Calculate shipping fee
        const storeFeePromises = Object.entries(itemsByStore).map(async ([storeId, storeItems]) => {
          try {
            // a. Lấy địa chỉ gửi từ product đầu tiên của store
            const firstItem = storeItems[0];
            const firstItemCache = cacheToUse[firstItem.refId];
            
            if (!firstItemCache?.districtCode || !firstItemCache?.wardCode) {
              return { storeId, fee: 0, error: 'Missing origin address' };
            }

            const fromDistrictId = parseInt(firstItemCache.districtCode);
            const fromWardCode = firstItemCache.wardCode;

            if (!fromDistrictId || !fromWardCode) {
              return { storeId, fee: 0, error: 'Invalid origin address' };
            }

            // b. Build GHN items
            const ghnItems = buildGHNItems(storeItems, cacheToUse);

            // c. Tính tổng weight của package
            const totalWeightGrams = calculateTotalWeightGrams(storeItems, cacheToUse);
            if (totalWeightGrams === 0) {
              return { storeId, fee: 0, error: 'Zero weight' };
            }

            // d. Tính service type (2 hoặc 5)
            const serviceType = calculateServiceType(storeItems, cacheToUse);

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

            // f. Gọi GHN API
            const fee = await calculateGHNFee(ghnRequest, accessToken);
            
            // Step 6: Xử lý response từ GHN API
            return { storeId, fee, error: null };
          } catch (error: any) {
            // Step 6: Xử lý error
            if (error?.response?.status === 404) {
              return { storeId, fee: 0, error: null }; // Service not available, not an error
            }
            const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
            return { storeId, fee: 0, error: errorMessage };
          }
        });

        // Step 7: Sum tổng shipping fee từ tất cả stores
        const storeFeeResults = await Promise.all(storeFeePromises);
        const feesMap: Record<string, number> = {};
        const errorsMap: Record<string, string> = {};
        let totalFee = 0;
        let hasError = false;

        storeFeeResults.forEach(({ storeId, fee, error }) => {
          feesMap[storeId] = fee;
          totalFee += fee;
          if (error) {
            errorsMap[storeId] = error;
            hasError = true;
          }
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
        console.error('[CheckoutScreen] calculateShippingFee failed', error);
        setShippingFeeError('Không thể tính phí ship. Vui lòng thử lại.');
        setShippingFee(0);
        setStoreShippingFees({});
      } finally {
        setIsCalculatingShipping(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [
    selectedAddressId,
    cartItems,
    addresses,
    productCache,
    authState.decodedToken?.customerId,
    authState.accessToken,
    fetchMissingProductDetails,
  ]);

  // Prefill cart from navigation params
  useEffect(() => {
    if (route.params?.cart) {
      setCart(route.params.cart);
    }
  }, [route.params?.cart]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadData();
      }
    }, [isAuthenticated, loadData]),
  );

  useEffect(() => {
    if (!isAuthenticated) {
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
      const storeTotal = storeTotals[voucher.storeId || ''] || 0;
      if (voucher.minOrderValue && storeTotal < voucher.minOrderValue) {
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
    setAppliedStoreVouchers((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  // Apply/remove store-wide voucher
  const handleApplyStoreWideVoucher = useCallback(
    (voucher: ShopVoucher, storeId: string) => {
      const storeTotal = storeTotals[storeId] || 0;
      if (voucher.minOrderValue && storeTotal < voucher.minOrderValue) {
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
    setAppliedStoreWideVouchers((prev) => {
      const next = { ...prev };
      delete next[storeId];
      return next;
    });
  }, []);

  // Calculate pricing
  const pricing = useMemo(() => {
    if (!cart || cartItems.length === 0) {
      return {
        subtotalBeforePlatformDiscount: 0,
        subtotalAfterPlatformDiscount: 0,
        totalPlatformDiscount: 0,
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

    // Voucher discounts
    const storeVoucherDiscount = Object.values(appliedStoreVouchers).reduce(
      (sum, v) => sum + v.discountValue,
      0,
    );
    const storeWideVoucherDiscount = Object.values(appliedStoreWideVouchers).reduce(
      (sum, v) => sum + v.discountValue,
      0,
    );
    const voucherDiscount = Math.round(storeVoucherDiscount + storeWideVoucherDiscount);

    const total = Math.max(
      0,
      Math.round(
        subtotalBeforePlatformDiscount - totalPlatformDiscount - voucherDiscount + shippingFee,
      ),
    );

    return {
      subtotalBeforePlatformDiscount,
      subtotalAfterPlatformDiscount,
      totalPlatformDiscount,
      voucherDiscount,
      shippingFee,
      total,
    };
  }, [cart, cartItems, appliedStoreVouchers, appliedStoreWideVouchers, shippingFee]);

  // Build checkout payload
  const buildCheckoutPayload = useCallback(() => {
    if (!selectedAddressId || !cart) return null;

    const items = cartItems.map((item) => {
      const payload: any = {
        type: 'PRODUCT' as const,
        quantity: item.quantity,
      };
      // If has variantId, send variantId (don't send productId)
      if (item.variantId) {
        payload.variantId = item.variantId;
      } else {
        // If no variantId, send productId (refId)
        // Note: COMBO handling would require additional field in CartItem type
        // For now, treat all items without variantId as PRODUCT
        payload.productId = item.refId;
      }
      return payload;
    });

    const storeVouchers = [
      ...Object.values(appliedStoreVouchers).map((v) => ({
        voucherId: v.voucherId,
        code: v.code,
        storeId: v.storeId,
      })),
      ...Object.values(appliedStoreWideVouchers).map((v) => ({
        voucherId: v.voucherId,
        code: v.code,
        storeId: v.storeId,
      })),
    ];

    // Calculate serviceTypeId for each store
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

    // Build platform vouchers
    const platformVouchersMap: Record<string, { campaignProductId: string; quantity: number; platformVoucherId?: string }> = {};
    cartItems.forEach((item) => {
      const discount = platformVoucherDiscounts[item.refId];
      if (discount && discount.campaignProductId) {
        const key = discount.campaignProductId;
        if (!platformVouchersMap[key]) {
          platformVouchersMap[key] = {
            campaignProductId: discount.campaignProductId,
            quantity: 0,
            platformVoucherId: discount.platformVoucherId,
          };
        }
        platformVouchersMap[key].quantity += item.quantity;
      }
    });

    const platformVouchers = Object.values(platformVouchersMap).filter(
      (v) => v.campaignProductId && v.quantity > 0,
    );

    return {
      items,
      addressId: selectedAddressId,
      message: null,
      storeVouchers: storeVouchers.length > 0 ? storeVouchers : null,
      platformVouchers: platformVouchers.length > 0 ? platformVouchers : null,
      serviceTypeIds: Object.keys(serviceTypeIds).length > 0 ? serviceTypeIds : null,
    };
  }, [
    selectedAddressId,
    cart,
    cartItems,
    appliedStoreVouchers,
    appliedStoreWideVouchers,
    productCache,
    storeTotals,
    platformVoucherDiscounts,
  ]);

  // Handle checkout
  const handleCheckout = useCallback(async () => {
    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;
    if (!customerId || !accessToken) return;

    const payload = buildCheckoutPayload();
    if (!payload) {
      setSnackbarMessage('Vui lòng chọn địa chỉ giao hàng');
      setSnackbarVisible(true);
      return;
    }

    try {
      setIsSubmitting(true);
      if (paymentMethod === 'COD') {
        const result = await checkoutCod({ customerId, accessToken, payload });
        setSnackbarMessage('Đặt hàng thành công!');
        setSnackbarVisible(true);
        // Navigate to orders screen
        setTimeout(() => {
          // @ts-ignore
          navigation.navigate('Profile');
        }, 2000);
      } else {
        // PayOS
        const returnUrl = 'https://audioe-commerce-production.up.railway.app/checkout/success';
        const cancelUrl = 'https://audioe-commerce-production.up.railway.app/checkout/cancel';
        const result = await checkoutPayOS({
          customerId,
          accessToken,
          payload: { ...payload, returnUrl, cancelUrl },
        });
        // Redirect to PayOS URL
        // In React Native, you might need to use Linking.openURL or WebBrowser
        setSnackbarMessage('Đang chuyển đến trang thanh toán...');
        setSnackbarVisible(true);
      }
    } catch (error: any) {
      console.error('[CheckoutScreen] checkout failed', error);
      const message =
        error?.response?.data?.message || 'Không thể đặt hàng. Vui lòng thử lại.';
      setSnackbarMessage(message);
      setSnackbarVisible(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [paymentMethod, buildCheckoutPayload, authState.decodedToken?.customerId, authState.accessToken, navigation]);

  // Handle remove item
  const handleRemoveItem = useCallback(
    async (cartItemId: string) => {
      const customerId = authState.decodedToken?.customerId;
      const accessToken = authState.accessToken;
      if (!customerId || !accessToken) return;
      try {
        await deleteCartItems({ customerId, accessToken, cartItemIds: [cartItemId] });
        await loadData();
      } catch (error: any) {
        console.error('[CheckoutScreen] remove item failed', error);
        setSnackbarMessage('Không thể xóa sản phẩm. Vui lòng thử lại.');
        setSnackbarVisible(true);
      }
    },
    [authState.decodedToken?.customerId, authState.accessToken, loadData],
  );

  const renderAddressSection = () => (
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
        addresses.map((addr) => (
          <TouchableOpacity
            key={addr.id}
            style={styles.addressRow}
            onPress={() => setSelectedAddressId(addr.id)}
          >
            <RadioButton
              value={addr.id}
              status={selectedAddressId === addr.id ? 'checked' : 'unchecked'}
              color={ORANGE}
              onPress={() => setSelectedAddressId(addr.id)}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressName}>{addr.receiverName}</Text>
              <Text style={styles.addressText}>{addr.phoneNumber}</Text>
              <Text style={styles.addressText}>
                {addr.addressLine}, {addr.street}, {addr.ward}, {addr.district}, {addr.province}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const renderItems = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sản phẩm</Text>
      {cartItems.map((item) => {
        const hasDiscount = item.finalPrice < item.originalPrice;
        return (
          <View key={item.cartItemId} style={styles.itemRow}>
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
      <TouchableOpacity
        style={styles.paymentRow}
        onPress={() => setPaymentMethod('COD')}
      >
        <RadioButton
          value="COD"
          status={paymentMethod === 'COD' ? 'checked' : 'unchecked'}
          color={ORANGE}
          onPress={() => setPaymentMethod('COD')}
        />
        <Text style={styles.paymentLabel}>Thanh toán khi nhận hàng (COD)</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.paymentRow}
        onPress={() => setPaymentMethod('PAYOS')}
      >
        <RadioButton
          value="PAYOS"
          status={paymentMethod === 'PAYOS' ? 'checked' : 'unchecked'}
          color={ORANGE}
          onPress={() => setPaymentMethod('PAYOS')}
        />
        <Text style={styles.paymentLabel}>Thanh toán online (PayOS)</Text>
      </TouchableOpacity>
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
          {pricing.voucherDiscount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm voucher</Text>
              <Text style={[styles.summaryValue, styles.summaryDiscount]}>
                -{formatCurrencyVND(pricing.voucherDiscount)}
              </Text>
            </View>
          )}
           <View style={styles.summaryRow}>
             <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
             {isCalculatingShipping ? (
               <ActivityIndicator size="small" color={ORANGE} />
             ) : pricing.shippingFee > 0 ? (
               <Text style={styles.summaryValue}>{formatCurrencyVND(pricing.shippingFee)}</Text>
             ) : (
               <Text style={styles.summaryValue}>{formatCurrencyVND(0)}</Text>
             )}
           </View>
          {shippingFeeError && (
            <Text style={styles.errorText}>{shippingFeeError}</Text>
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
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
