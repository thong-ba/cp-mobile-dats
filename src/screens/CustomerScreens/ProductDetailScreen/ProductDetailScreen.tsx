import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Chip, Snackbar } from 'react-native-paper';
import { useAuth } from '../../../context/AuthContext';
import { ProductStackParamList } from '../../../navigation/ProductStackNavigator';
import { addItemsToCart } from '../../../services/cartService';
import { getProductById, getProductVouchers } from '../../../services/productService';
import { PlatformCampaign, PlatformVoucherItem, ProductDetail } from '../../../types/product';

const { width } = Dimensions.get('window');
const ORANGE = '#FF6A00';

type ProductDetailRouteProp = RouteProp<ProductStackParamList, 'ProductDetail'>;

const formatCurrencyVND = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

const ProductDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<ProductDetailRouteProp>();
  const { productId } = route.params;

  const { authState } = useAuth();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [platformCampaigns, setPlatformCampaigns] = useState<PlatformCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  
  // Animation refs
  const animatedValue = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  // Refs for measuring positions
  const addToCartButtonRef = useRef<View>(null);
  const cartIconRef = useRef<View>(null);

  const loadProduct = async (isPullRefresh = false) => {
    try {
      if (isPullRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);
      const [detailData, voucherData] = await Promise.all([
        getProductById(productId),
        getProductVouchers(productId).catch(() => null),
      ]);
      setProduct(detailData);
      setPlatformCampaigns(voucherData?.vouchers?.platform ?? []);
    } catch (error: any) {
      console.error('[ProductDetailScreen] loadProduct failed', error);
      const message =
        error?.response?.status === 404
          ? 'Sản phẩm không tồn tại'
          : error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.message?.includes('Network')
          ? 'Không có kết nối mạng. Vui lòng thử lại.'
          : 'Không thể tải thông tin sản phẩm. Vui lòng thử lại.';
      setErrorMessage(message);
    } finally {
      if (isPullRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const startAddToCartAnimation = () => {
    setShowAnimation(true);
    
    // Reset animation values
    animatedValue.setValue(0);
    scaleAnim.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    
    // Get positions (approximate - cart icon is in header top right, add to cart button is at bottom)
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate distance from button to cart icon
    // Add to cart button position (bottom center): approximately width / 2, height - 100
    const startX = screenWidth / 2; // Center of screen (where button is)
    const startY = screenHeight - 100; // Bottom area (where button is)
    
    // Cart icon position (top right of header): approximately width - 40 (right padding), 60 (header height/2)
    // Header has padding, so cart icon is at: width - 16 (padding) - 20 (icon size/2) = width - 36
    const endX = screenWidth - 36; // Right side (where cart icon is) - accounting for padding
    const endY = 60; // Top area (middle of header, where cart icon is)
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    // Animate: scale down and move to cart icon (top right)
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.2,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: deltaX,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: deltaY,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleAddToCart = async () => {
    if (!product) return;

    const customerId = authState.decodedToken?.customerId;
    const accessToken = authState.accessToken;

    if (!customerId || !accessToken) {
      // Navigate to Profile tab (which will show Login screen if not authenticated)
      const tabNavigator = navigation.getParent();
      if (tabNavigator) {
        // @ts-ignore - navigate to Profile tab
        tabNavigator.navigate('Profile');
      }
      setSnackbarMessage('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng');
      setSnackbarVisible(true);
      return;
    }

    // Validate variant selection
    if (product.variants && product.variants.length > 0 && !selectedVariantId) {
      setSnackbarMessage('Vui lòng chọn biến thể trước khi thêm vào giỏ hàng');
      setSnackbarVisible(true);
      return;
    }

    try {
      setIsAddingToCart(true);

      // Prepare request payload based on product type
      // Logic:
      // - Nếu có variant: gửi variantId, productId và comboId để trống
      // - Nếu có combo: gửi comboId, productId và variantId để trống
      // - Nếu không có variant và combo: chỉ gửi productId, variantId và comboId để trống
      const items = [
        {
          type: 'PRODUCT' as const,
          productId:
            product.variants && product.variants.length > 0
              ? ''
              : selectedComboId
              ? ''
              : product.productId,
          variantId: selectedVariantId || '',
          comboId: selectedComboId || '',
          quantity: 1,
        },
      ];

      await addItemsToCart({
        customerId,
        accessToken,
        payload: { items },
      });

      // Start animation
      startAddToCartAnimation();
      
      // Show success modal after animation
      setTimeout(() => {
        setShowSuccessModal(true);
        setShowAnimation(false);
        // Reset animation values
        animatedValue.setValue(0);
        scaleAnim.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
      }, 1000);
    } catch (error: any) {
      console.error('[ProductDetailScreen] addToCart failed', error);
      const message =
        error?.response?.status === 401
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : error?.response?.data?.message || 'Không thể thêm vào giỏ hàng. Vui lòng thử lại.';
      setSnackbarMessage(message);
      setSnackbarVisible(true);
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (isLoading && !product) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.loaderText}>Đang tải thông tin sản phẩm...</Text>
      </View>
    );
  }

  if (errorMessage && !product) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#B3261E" />
        <Text style={styles.errorText}>{errorMessage}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadProduct()}>
          <Text style={styles.retryText}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!product) {
    return null;
  }

  const mainImage = product.images?.[selectedImageIndex] || product.images?.[0] || '';

  // Pricing logic with platform/flash sale vouchers
  const computePricing = () => {
    // base prices from variants or product
    const variantPrices =
      product.variants?.map((v) => v.variantPrice ?? 0).filter((p) => p > 0) ?? [];
    let basePrices: number[] = [];
    if (product.variants && product.variants.length > 0) {
      if (selectedVariantId) {
        const selected = product.variants.find((v) => v.variantId === selectedVariantId);
        if (selected) {
          basePrices = [selected.variantPrice ?? 0];
        }
      }
      if (basePrices.length === 0) {
        basePrices = variantPrices.length > 0 ? variantPrices : [0];
      }
    } else {
      basePrices = [
        product.price ??
          product.finalPrice ??
          product.priceAfterPromotion ??
          product.discountPrice ??
          0,
      ];
    }

    // pick active campaign + voucher
    const now = new Date();
    const isActiveCampaign = (c?: PlatformCampaign | null) => {
      if (!c) return false;
      const hasSlot = c.vouchers?.[0]?.slotOpenTime && c.vouchers?.[0]?.slotCloseTime;
      if (hasSlot) {
        const slotOpen = c.vouchers?.[0]?.slotOpenTime ? new Date(c.vouchers[0].slotOpenTime!) : null;
        const slotClose = c.vouchers?.[0]?.slotCloseTime ? new Date(c.vouchers[0].slotCloseTime!) : null;
        const slotStatus = c.vouchers?.[0]?.slotStatus;
        if (slotOpen && slotClose && slotStatus === 'ACTIVE') {
          return slotOpen <= now && now <= slotClose;
        }
      }
      const start = c.startTime ? new Date(c.startTime) : null;
      const end = c.endTime ? new Date(c.endTime) : null;
      const campaignActive = c.status === 'ACTIVE' && (!start || start <= now) && (!end || end >= now);
      return campaignActive;
    };

    const isActiveVoucher = (v?: PlatformVoucherItem | null) => {
      if (!v) return false;
      const start = v.startTime ? new Date(v.startTime) : null;
      const end = v.endTime ? new Date(v.endTime) : null;
      const voucherActive = (v.status === 'ACTIVE' || !v.status) && (!start || start <= now) && (!end || end >= now);
      const hasSlot = v.slotOpenTime && v.slotCloseTime;
      if (hasSlot) {
        const slotOpen = v.slotOpenTime ? new Date(v.slotOpenTime) : null;
        const slotClose = v.slotCloseTime ? new Date(v.slotCloseTime) : null;
        const slotActive = v.slotStatus === 'ACTIVE' && (!slotOpen || slotOpen <= now) && (!slotClose || slotClose >= now);
        return voucherActive && slotActive;
      }
      return voucherActive;
    };

    const activeCampaign = platformCampaigns.find((c) => isActiveCampaign(c));
    const activeVoucher = activeCampaign?.vouchers?.find((v) => isActiveVoucher(v));

    const applyVoucher = (price: number) => {
      if (!activeVoucher || price <= 0) return price;
      if (activeVoucher.type === 'PERCENT' && activeVoucher.discountPercent) {
        const discountValue = (price * activeVoucher.discountPercent) / 100;
        const capped =
          activeVoucher.maxDiscountValue !== null && activeVoucher.maxDiscountValue !== undefined
            ? Math.min(discountValue, activeVoucher.maxDiscountValue)
            : discountValue;
        return Math.max(0, price - capped);
      }
      if (activeVoucher.type === 'FIXED' && activeVoucher.discountValue) {
        return Math.max(0, price - activeVoucher.discountValue);
      }
      return price;
    };

    const discountedPrices = basePrices.map(applyVoucher);
    const originalRange =
      basePrices.length > 1
        ? { min: Math.min(...basePrices), max: Math.max(...basePrices) }
        : null;
    const discountedRange =
      discountedPrices.length > 1
        ? { min: Math.min(...discountedPrices), max: Math.max(...discountedPrices) }
        : null;

    const displayPrice = discountedPrices[0] ?? 0;
    const originalPrice = basePrices[0] ?? 0;
    const hasDiscount = discountedPrices.some((p, idx) => p < (basePrices[idx] ?? p));

    return {
      displayPrice,
      originalPrice,
      hasDiscount,
      originalRange,
      discountedRange,
      badge: activeCampaign
        ? {
            label: activeCampaign.badgeLabel,
            color: activeCampaign.badgeColor,
            iconUrl: activeCampaign.badgeIconUrl,
          }
        : null,
    };
  };

  const pricing = computePricing();

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product.name}
        </Text>
        <TouchableOpacity
          style={styles.cartIconButton}
          onPress={() => {
            // @ts-ignore - navigate to Cart
            navigation.navigate('Cart');
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="cart-outline" size={24} color="#FFFFFF" />
          {cartItemsCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartItemsCount > 99 ? '99+' : cartItemsCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => loadProduct(true)} />
        }
      >
        {/* Product Images */}
        {product.images && product.images.length > 0 && (
          <View style={styles.imageSection}>
            <Image source={{ uri: mainImage }} style={styles.mainImage} resizeMode="contain" />
            {product.images.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbnailContainer}
                contentContainerStyle={styles.thumbnailContent}
              >
                {product.images.map((image, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setSelectedImageIndex(index)}
                    style={[
                      styles.thumbnail,
                      selectedImageIndex === index && styles.thumbnailSelected,
                    ]}
                  >
                    <Image source={{ uri: image }} style={styles.thumbnailImage} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Product Info */}
        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.productName}>{product.name}</Text>
            {product.isFeatured && (
              <Chip compact style={styles.featuredChip}>
                Nổi bật
              </Chip>
            )}
          </View>

          {product.shortDescription && (
            <Text style={styles.shortDescription}>{product.shortDescription}</Text>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.finalPrice}>
              {pricing.discountedRange
                ? `${formatCurrencyVND(pricing.discountedRange.min)} - ${formatCurrencyVND(
                    pricing.discountedRange.max,
                  )}`
                : formatCurrencyVND(pricing.displayPrice)}
            </Text>
            {pricing.hasDiscount && (
              <Text style={styles.originalPrice}>
                {pricing.originalRange
                  ? `${formatCurrencyVND(pricing.originalRange.min)} - ${formatCurrencyVND(
                      pricing.originalRange.max,
                    )}`
                  : formatCurrencyVND(pricing.originalPrice)}
              </Text>
            )}
            {pricing.badge?.label ? (
              <Chip
                compact
                style={[styles.discountChip, pricing.badge.color ? { backgroundColor: pricing.badge.color } : null]}
                textStyle={{ color: '#FFF', fontWeight: '700' }}
              >
                {pricing.badge.label || 'Giảm giá'}
              </Chip>
            ) : null}
          </View>

          {/* Rating & Reviews */}
          {(product.ratingAverage !== null || product.reviewCount !== null) && (
            <View style={styles.ratingRow}>
              {product.ratingAverage !== null && (
                <View style={styles.ratingItem}>
                  <MaterialCommunityIcons name="star" size={18} color="#FFA800" />
                  <Text style={styles.ratingText}>{product.ratingAverage.toFixed(1)}</Text>
                </View>
              )}
              {product.reviewCount !== null && (
                <Text style={styles.reviewCount}>({product.reviewCount} đánh giá)</Text>
              )}
            </View>
          )}

          {/* Store Info */}
          <View style={styles.storeRow}>
            <MaterialCommunityIcons name="store" size={18} color={ORANGE} />
            <Text style={styles.storeName}>{product.storeName}</Text>
          </View>

          {/* Stock Status */}
          <View style={styles.stockRow}>
            <MaterialCommunityIcons
              name={product.stockQuantity > 0 ? 'check-circle' : 'close-circle'}
              size={18}
              color={product.stockQuantity > 0 ? '#4CAF50' : '#B3261E'}
            />
            <Text
              style={[
                styles.stockText,
                { color: product.stockQuantity > 0 ? '#4CAF50' : '#B3261E' },
              ]}
            >
              {product.stockQuantity > 0
                ? `Còn ${product.stockQuantity} sản phẩm`
                : 'Hết hàng'}
            </Text>
          </View>
        </View>

        {/* Variants Selector */}
        {product.variants && product.variants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Chọn biến thể <Text style={styles.required}>*</Text>
            </Text>
            {product.variants.map((variant) => (
              <TouchableOpacity
                key={variant.variantId}
                style={[
                  styles.variantCard,
                  selectedVariantId === variant.variantId && styles.variantCardSelected,
                ]}
                onPress={() => setSelectedVariantId(variant.variantId)}
                activeOpacity={0.7}
              >
                <View style={styles.variantCardContent}>
                  <View style={styles.variantCardLeft}>
                    {variant.variantUrl && (
                      <Image source={{ uri: variant.variantUrl }} style={styles.variantImage} />
                    )}
                    <View style={styles.variantInfo}>
                      <Text style={styles.variantText}>
                        {variant.optionName}: {variant.optionValue}
                      </Text>
                      <Text style={styles.variantStock}>Còn: {variant.variantStock}</Text>
                    </View>
                  </View>
                  <View style={styles.variantCardRight}>
                    <Text style={styles.variantPrice}>
                      {formatCurrencyVND(variant.variantPrice)}
                    </Text>
                    {selectedVariantId === variant.variantId && (
                      <MaterialCommunityIcons name="check-circle" size={24} color={ORANGE} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            {!selectedVariantId && (
              <Text style={styles.variantWarning}>
                Vui lòng chọn biến thể trước khi thêm vào giỏ hàng
              </Text>
            )}
          </View>
        )}

        {/* Description - Moved to top */}
        {product.description && product.description !== 'string' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mô tả sản phẩm</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>
        )}

        {/* Product Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Thương hiệu:</Text>
            <Text style={styles.detailValue}>{product.brandName || 'N/A'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Danh mục:</Text>
            <Text style={styles.detailValue}>{product.categoryName}</Text>
          </View>
          {product.model && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Model:</Text>
              <Text style={styles.detailValue}>{product.model}</Text>
            </View>
          )}
          {product.color && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Màu sắc:</Text>
              <Text style={styles.detailValue}>{product.color}</Text>
            </View>
          )}
          {product.material && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Chất liệu:</Text>
              <Text style={styles.detailValue}>{product.material}</Text>
            </View>
          )}
          {product.dimensions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kích thước:</Text>
              <Text style={styles.detailValue}>{product.dimensions}</Text>
            </View>
          )}
          {product.weight !== undefined && product.weight !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Trọng lượng:</Text>
              <Text style={styles.detailValue}>{product.weight} kg</Text>
            </View>
          )}
          {product.productCondition && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tình trạng:</Text>
              <Text style={styles.detailValue}>{product.productCondition}</Text>
            </View>
          )}
          {product.isCustomMade !== undefined && product.isCustomMade !== null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sản xuất tùy chỉnh:</Text>
              <Text style={styles.detailValue}>{product.isCustomMade ? 'Có' : 'Không'}</Text>
            </View>
          )}
        </View>

        {/* Audio Specifications */}
        {(product.frequencyResponse ||
          product.sensitivity ||
          product.impedance ||
          product.powerHandling ||
          product.connectionType ||
          product.voltageInput) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số kỹ thuật âm thanh</Text>
            {product.frequencyResponse && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Dải tần số:</Text>
                <Text style={styles.detailValue}>{product.frequencyResponse}</Text>
              </View>
            )}
            {product.sensitivity && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Độ nhạy:</Text>
                <Text style={styles.detailValue}>{product.sensitivity}</Text>
              </View>
            )}
            {product.impedance && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Trở kháng:</Text>
                <Text style={styles.detailValue}>{product.impedance}</Text>
              </View>
            )}
            {product.powerHandling && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Công suất:</Text>
                <Text style={styles.detailValue}>{product.powerHandling}</Text>
              </View>
            )}
            {product.connectionType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại kết nối:</Text>
                <Text style={styles.detailValue}>{product.connectionType}</Text>
              </View>
            )}
            {product.voltageInput && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Điện áp đầu vào:</Text>
                <Text style={styles.detailValue}>{product.voltageInput}</Text>
              </View>
            )}
          </View>
        )}

        {/* Speaker Specifications - Only for Loa category */}
        {product.categoryName === 'Loa' &&
          (product.driverConfiguration ||
            product.driverSize ||
            product.enclosureType ||
            product.coveragePattern ||
            product.crossoverFrequency ||
            product.placementType) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số loa</Text>
            {product.driverConfiguration && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Cấu hình driver:</Text>
                <Text style={styles.detailValue}>{product.driverConfiguration}</Text>
              </View>
            )}
            {product.driverSize && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kích thước driver:</Text>
                <Text style={styles.detailValue}>{product.driverSize}</Text>
              </View>
            )}
            {product.enclosureType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại vỏ:</Text>
                <Text style={styles.detailValue}>{product.enclosureType}</Text>
              </View>
            )}
            {product.coveragePattern && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Góc phủ sóng:</Text>
                <Text style={styles.detailValue}>{product.coveragePattern}</Text>
              </View>
            )}
            {product.crossoverFrequency && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tần số crossover:</Text>
                <Text style={styles.detailValue}>{product.crossoverFrequency}</Text>
              </View>
            )}
            {product.placementType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại đặt:</Text>
                <Text style={styles.detailValue}>{product.placementType}</Text>
              </View>
            )}
          </View>
        )}

        {/* Headphone Specifications - Only for Tai Nghe category */}
        {product.categoryName === 'Tai Nghe' &&
          (product.headphoneType ||
            product.compatibleDevices ||
            product.isSportsModel !== undefined ||
            product.headphoneFeatures ||
            product.batteryCapacity ||
            product.hasBuiltInBattery !== undefined ||
            product.isGamingHeadset !== undefined ||
            product.headphoneAccessoryType ||
            product.headphoneConnectionType ||
            product.plugType) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số tai nghe</Text>
            {product.headphoneType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại tai nghe:</Text>
                <Text style={styles.detailValue}>{product.headphoneType}</Text>
              </View>
            )}
            {product.compatibleDevices && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Thiết bị tương thích:</Text>
                <Text style={styles.detailValue}>{product.compatibleDevices}</Text>
              </View>
            )}
            {product.isSportsModel !== undefined && product.isSportsModel !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mẫu thể thao:</Text>
                <Text style={styles.detailValue}>{product.isSportsModel ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.headphoneFeatures && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tính năng:</Text>
                <Text style={styles.detailValue}>{product.headphoneFeatures}</Text>
              </View>
            )}
            {product.batteryCapacity && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Dung lượng pin:</Text>
                <Text style={styles.detailValue}>{product.batteryCapacity}</Text>
              </View>
            )}
            {product.hasBuiltInBattery !== undefined && product.hasBuiltInBattery !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pin tích hợp:</Text>
                <Text style={styles.detailValue}>{product.hasBuiltInBattery ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.isGamingHeadset !== undefined && product.isGamingHeadset !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tai nghe gaming:</Text>
                <Text style={styles.detailValue}>{product.isGamingHeadset ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.headphoneAccessoryType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại phụ kiện:</Text>
                <Text style={styles.detailValue}>{product.headphoneAccessoryType}</Text>
              </View>
            )}
            {product.headphoneConnectionType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại kết nối:</Text>
                <Text style={styles.detailValue}>{product.headphoneConnectionType}</Text>
              </View>
            )}
            {product.plugType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại jack cắm:</Text>
                <Text style={styles.detailValue}>{product.plugType}</Text>
              </View>
            )}
          </View>
        )}

        {/* Microphone Specifications - Only for Micro category */}
        {product.categoryName === 'Micro' &&
          (product.micType ||
            product.polarPattern ||
            product.maxSPL ||
            product.micOutputImpedance ||
            product.micSensitivity) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số microphone</Text>
            {product.micType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại mic:</Text>
                <Text style={styles.detailValue}>{product.micType}</Text>
              </View>
            )}
            {product.polarPattern && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Pattern phân cực:</Text>
                <Text style={styles.detailValue}>{product.polarPattern}</Text>
              </View>
            )}
            {product.maxSPL && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SPL tối đa:</Text>
                <Text style={styles.detailValue}>{product.maxSPL}</Text>
              </View>
            )}
            {product.micOutputImpedance && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Trở kháng đầu ra:</Text>
                <Text style={styles.detailValue}>{product.micOutputImpedance}</Text>
              </View>
            )}
            {product.micSensitivity && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Độ nhạy mic:</Text>
                <Text style={styles.detailValue}>{product.micSensitivity}</Text>
              </View>
            )}
          </View>
        )}

        {/* Amplifier Specifications - Only for Amp category */}
        {product.categoryName === 'Amp' &&
          (product.amplifierType ||
            product.totalPowerOutput ||
            product.thd ||
            product.snr ||
            product.inputChannels !== undefined ||
            product.outputChannels !== undefined) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số amplifier</Text>
            {product.amplifierType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại amplifier:</Text>
                <Text style={styles.detailValue}>{product.amplifierType}</Text>
              </View>
            )}
            {product.totalPowerOutput && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Công suất tổng:</Text>
                <Text style={styles.detailValue}>{product.totalPowerOutput}</Text>
              </View>
            )}
            {product.thd && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>THD:</Text>
                <Text style={styles.detailValue}>{product.thd}</Text>
              </View>
            )}
            {product.snr && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SNR:</Text>
                <Text style={styles.detailValue}>{product.snr}</Text>
              </View>
            )}
            {product.inputChannels !== undefined && product.inputChannels !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kênh đầu vào:</Text>
                <Text style={styles.detailValue}>{product.inputChannels}</Text>
              </View>
            )}
            {product.outputChannels !== undefined && product.outputChannels !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Kênh đầu ra:</Text>
                <Text style={styles.detailValue}>{product.outputChannels}</Text>
              </View>
            )}
          </View>
        )}

        {/* Connectivity & Features */}
        {(product.supportBluetooth !== undefined ||
          product.supportWifi !== undefined ||
          product.supportAirplay !== undefined) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kết nối & Tính năng</Text>
            {product.supportBluetooth !== undefined && product.supportBluetooth !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hỗ trợ Bluetooth:</Text>
                <Text style={styles.detailValue}>{product.supportBluetooth ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.supportWifi !== undefined && product.supportWifi !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hỗ trợ WiFi:</Text>
                <Text style={styles.detailValue}>{product.supportWifi ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.supportAirplay !== undefined && product.supportAirplay !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hỗ trợ AirPlay:</Text>
                <Text style={styles.detailValue}>{product.supportAirplay ? 'Có' : 'Không'}</Text>
              </View>
            )}
          </View>
        )}

        {/* Turntable Specifications - Only for Turntable category */}
        {product.categoryName === 'Turntable' &&
          (product.platterMaterial ||
            product.motorType ||
            product.tonearmType ||
            product.autoReturn !== undefined) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số máy quay đĩa</Text>
            {product.platterMaterial && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Chất liệu platter:</Text>
                <Text style={styles.detailValue}>{product.platterMaterial}</Text>
              </View>
            )}
            {product.motorType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại motor:</Text>
                <Text style={styles.detailValue}>{product.motorType}</Text>
              </View>
            )}
            {product.tonearmType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại tonearm:</Text>
                <Text style={styles.detailValue}>{product.tonearmType}</Text>
              </View>
            )}
            {product.autoReturn !== undefined && product.autoReturn !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tự động trả về:</Text>
                <Text style={styles.detailValue}>{product.autoReturn ? 'Có' : 'Không'}</Text>
              </View>
            )}
          </View>
        )}

        {/* DAC Specifications - Only for DAC category */}
        {product.categoryName === 'DAC' &&
          (product.dacChipset ||
            product.sampleRate ||
            product.bitDepth ||
            product.balancedOutput !== undefined) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số DAC</Text>
            {product.dacChipset && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Chipset DAC:</Text>
                <Text style={styles.detailValue}>{product.dacChipset}</Text>
              </View>
            )}
            {product.sampleRate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tần số lấy mẫu:</Text>
                <Text style={styles.detailValue}>{product.sampleRate}</Text>
              </View>
            )}
            {product.bitDepth && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Độ sâu bit:</Text>
                <Text style={styles.detailValue}>{product.bitDepth}</Text>
              </View>
            )}
            {product.balancedOutput !== undefined && product.balancedOutput !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Đầu ra cân bằng:</Text>
                <Text style={styles.detailValue}>{product.balancedOutput ? 'Có' : 'Không'}</Text>
              </View>
            )}
          </View>
        )}

        {/* Mixer Specifications - Only for Mixer category */}
        {product.categoryName === 'Mixer' &&
          (product.inputInterface ||
            product.outputInterface ||
            product.channelCount !== undefined ||
            product.hasPhantomPower !== undefined ||
            product.eqBands ||
            product.faderType ||
            product.builtInEffects !== undefined ||
            product.usbAudioInterface !== undefined ||
            product.midiSupport !== undefined) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông số mixer</Text>
            {product.inputInterface && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Giao diện đầu vào:</Text>
                <Text style={styles.detailValue}>{product.inputInterface}</Text>
              </View>
            )}
            {product.outputInterface && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Giao diện đầu ra:</Text>
                <Text style={styles.detailValue}>{product.outputInterface}</Text>
              </View>
            )}
            {product.channelCount !== undefined && product.channelCount !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Số kênh:</Text>
                <Text style={styles.detailValue}>{product.channelCount}</Text>
              </View>
            )}
            {product.hasPhantomPower !== undefined && product.hasPhantomPower !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Phantom Power:</Text>
                <Text style={styles.detailValue}>{product.hasPhantomPower ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.eqBands && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Dải EQ:</Text>
                <Text style={styles.detailValue}>{product.eqBands}</Text>
              </View>
            )}
            {product.faderType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại fader:</Text>
                <Text style={styles.detailValue}>{product.faderType}</Text>
              </View>
            )}
            {product.builtInEffects !== undefined && product.builtInEffects !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hiệu ứng tích hợp:</Text>
                <Text style={styles.detailValue}>{product.builtInEffects ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.usbAudioInterface !== undefined && product.usbAudioInterface !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Giao diện USB Audio:</Text>
                <Text style={styles.detailValue}>{product.usbAudioInterface ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.midiSupport !== undefined && product.midiSupport !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hỗ trợ MIDI:</Text>
                <Text style={styles.detailValue}>{product.midiSupport ? 'Có' : 'Không'}</Text>
              </View>
            )}
          </View>
        )}

        {/* Certification & Warranty */}
        {(product.sirimApproved !== undefined ||
          product.sirimCertified !== undefined ||
          product.mcmcApproved !== undefined ||
          product.warrantyPeriod ||
          product.warrantyType ||
          product.manufacturerName ||
          product.manufacturerAddress) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chứng nhận & Bảo hành</Text>
            {product.sirimApproved !== undefined && product.sirimApproved !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SIRIM Approved:</Text>
                <Text style={styles.detailValue}>{product.sirimApproved ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.sirimCertified !== undefined && product.sirimCertified !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SIRIM Certified:</Text>
                <Text style={styles.detailValue}>{product.sirimCertified ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.mcmcApproved !== undefined && product.mcmcApproved !== null && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>MCMC Approved:</Text>
                <Text style={styles.detailValue}>{product.mcmcApproved ? 'Có' : 'Không'}</Text>
              </View>
            )}
            {product.warrantyPeriod && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Thời hạn bảo hành:</Text>
                <Text style={styles.detailValue}>{product.warrantyPeriod}</Text>
              </View>
            )}
            {product.warrantyType && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Loại bảo hành:</Text>
                <Text style={styles.detailValue}>{product.warrantyType}</Text>
              </View>
            )}
            {product.manufacturerName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nhà sản xuất:</Text>
                <Text style={styles.detailValue}>{product.manufacturerName}</Text>
              </View>
            )}
            {product.manufacturerAddress && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Địa chỉ nhà sản xuất:</Text>
                <Text style={styles.detailValue}>{product.manufacturerAddress}</Text>
              </View>
            )}
          </View>
        )}


        {/* Bulk Discounts */}
        {product.bulkDiscounts && product.bulkDiscounts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Giảm giá theo số lượng</Text>
            {product.bulkDiscounts.map((discount, index) => (
              <View key={index} style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  Từ {discount.fromQuantity} đến {discount.toQuantity} sản phẩm:
                </Text>
                <Text style={styles.detailValue}>
                  {formatCurrencyVND(discount.unitPrice)}/sản phẩm
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="heart-outline" size={24} color={ORANGE} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <MaterialCommunityIcons name="share-variant-outline" size={24} color={ORANGE} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.addToCartButton,
            (product.stockQuantity === 0 ||
              (product.variants && product.variants.length > 0 && !selectedVariantId) ||
              isAddingToCart) &&
              styles.disabledButton,
          ]}
          disabled={
            product.stockQuantity === 0 ||
            (product.variants && product.variants.length > 0 && !selectedVariantId) ||
            isAddingToCart
          }
          onPress={handleAddToCart}
        >
          {isAddingToCart ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="cart-plus" size={24} color="#FFFFFF" />
              <Text style={styles.addToCartText}>
                {product.stockQuantity > 0 ? 'Thêm vào giỏ' : 'Hết hàng'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Animation Overlay */}
      {showAnimation && product && (
        <View style={styles.animationOverlay} pointerEvents="none">
          <Animated.View
            style={[
              styles.animatedProduct,
              {
                left: Dimensions.get('window').width / 2 - 40, // Start from center (button position)
                top: Dimensions.get('window').height - 100, // Start from bottom (button position)
                transform: [
                  { translateX },
                  { translateY },
                  { scale: scaleAnim },
                ],
                opacity: animatedValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 0.8, 0],
                }),
              },
            ]}
          >
            <Image
              source={{ uri: product.images?.[0] || '' }}
              style={styles.animatedProductImage}
              resizeMode="cover"
            />
          </Animated.View>
        </View>
      )}

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="check-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.modalTitle}>Thành công!</Text>
            <Text style={styles.modalMessage}>Đã thêm sản phẩm vào giỏ hàng</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSuccessModal(false);
                // Optionally navigate to cart
                // @ts-ignore
                navigation.navigate('Cart');
              }}
            >
              <Text style={styles.modalButtonText}>Xem giỏ hàng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalCloseText}>Tiếp tục mua sắm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

export default ProductDetailScreen;

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
  cartIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF0000',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: ORANGE,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageSection: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  mainImage: {
    width: width,
    height: width,
    backgroundColor: '#F5F5F5',
  },
  thumbnailContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  thumbnailContent: {
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailSelected: {
    borderColor: ORANGE,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  productName: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  featuredChip: {
    backgroundColor: '#FFEFE6',
  },
  shortDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  finalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: ORANGE,
  },
  originalPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  discountChip: {
    backgroundColor: '#FFECEC',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  storeName: {
    fontSize: 14,
    color: '#666',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },
  variantCard: {
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  variantCardSelected: {
    borderColor: ORANGE,
    backgroundColor: '#FFF3EB',
  },
  variantCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variantCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  variantImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  variantInfo: {
    flex: 1,
  },
  variantText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  variantPrice: {
    fontSize: 16,
    color: ORANGE,
    fontWeight: '700',
  },
  variantStock: {
    fontSize: 12,
    color: '#666',
  },
  variantCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantWarning: {
    fontSize: 13,
    color: '#B3261E',
    fontStyle: 'italic',
    marginTop: 8,
  },
  required: {
    color: '#B3261E',
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    flex: 2,
    fontSize: 14,
    color: '#222',
    textAlign: 'right',
  },
  description: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF3EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: ORANGE,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  animationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    pointerEvents: 'none',
  },
  animatedProduct: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  animatedProductImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: ORANGE,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseButton: {
    paddingVertical: 8,
  },
  modalCloseText: {
    color: '#666',
    fontSize: 14,
  },
});

