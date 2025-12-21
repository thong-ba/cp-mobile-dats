import { PlatformCampaign, PlatformVoucherItem, ProductDetail, ProductVariant } from '../types/product';

export type PriceCalculationResult = {
  originalPrice: number;
  finalPrice: number;
  displayPrice: number;
  priceRangeText?: string | null;
  discountedPriceRangeText?: string | null;
  discountPercent: number;
  campaignBadge: { label: string; color: string } | null;
  hasDiscount: boolean;
};

/**
 * Check if a platform campaign is active
 */
const isActiveCampaign = (campaign: PlatformCampaign | null | undefined): boolean => {
  if (!campaign) return false;

  const now = new Date();
  const hasSlot = campaign.vouchers?.[0]?.slotOpenTime && campaign.vouchers?.[0]?.slotCloseTime;

  // Flash Sale: check slot time
  if (hasSlot) {
    const slotOpen = campaign.vouchers?.[0]?.slotOpenTime
      ? new Date(campaign.vouchers[0].slotOpenTime!)
      : null;
    const slotClose = campaign.vouchers?.[0]?.slotCloseTime
      ? new Date(campaign.vouchers[0].slotCloseTime!)
      : null;
    const slotStatus = campaign.vouchers?.[0]?.slotStatus;
    if (slotOpen && slotClose && slotStatus === 'ACTIVE') {
      return slotOpen <= now && now <= slotClose;
    }
  }

  // Mega Sale / Regular Campaign: check campaign time
  const start = campaign.startTime ? new Date(campaign.startTime) : null;
  const end = campaign.endTime ? new Date(campaign.endTime) : null;
  
  // If campaign has time range, check it
  if (start || end) {
    const campaignActive =
      (campaign.status === 'ACTIVE' || !campaign.status) &&
      (!start || start <= now) &&
      (!end || end >= now);
    return campaignActive;
  }

  // If no time range, only check status
  // Also check if there's at least one active voucher
  const hasActiveVoucher = campaign.vouchers?.some((v) => 
    v.status === 'ACTIVE' || !v.status
  );
  
  return (campaign.status === 'ACTIVE' || !campaign.status) && (hasActiveVoucher || campaign.vouchers?.length === 0);
};

/**
 * Check if a platform voucher is active
 */
const isActiveVoucher = (
  voucher: PlatformVoucherItem | null | undefined,
  campaign?: PlatformCampaign | null,
): boolean => {
  if (!voucher) return false;

  const now = new Date();
  const hasSlot = voucher.slotOpenTime && voucher.slotCloseTime;

  // Flash Sale: check slot time
  if (hasSlot) {
    const slotOpen = voucher.slotOpenTime ? new Date(voucher.slotOpenTime) : null;
    const slotClose = voucher.slotCloseTime ? new Date(voucher.slotCloseTime) : null;
    const slotActive =
      voucher.slotStatus === 'ACTIVE' &&
      (!slotOpen || slotOpen <= now) &&
      (!slotClose || slotClose >= now);
    return slotActive;
  }

  // Mega Sale / Regular Campaign: check voucher time or campaign time
  // If voucher has startTime/endTime, use them
  if (voucher.startTime || voucher.endTime) {
    const start = voucher.startTime ? new Date(voucher.startTime) : null;
    const end = voucher.endTime ? new Date(voucher.endTime) : null;
    const voucherActive =
      (voucher.status === 'ACTIVE' || !voucher.status) &&
      (!start || start <= now) &&
      (!end || end >= now);
    return voucherActive;
  }

  // If voucher doesn't have time, check campaign time (for MEGA_SALE)
  if (campaign && (campaign.startTime || campaign.endTime)) {
    const campaignStart = campaign.startTime ? new Date(campaign.startTime) : null;
    const campaignEnd = campaign.endTime ? new Date(campaign.endTime) : null;
    const campaignActive =
      (campaign.status === 'ACTIVE' || !campaign.status) &&
      (!campaignStart || campaignStart <= now) &&
      (!campaignEnd || campaignEnd >= now);
    
    // Voucher is active if status is ACTIVE and campaign is active
    return (voucher.status === 'ACTIVE' || !voucher.status) && campaignActive;
  }

  // Fallback: only check voucher status
  return voucher.status === 'ACTIVE' || !voucher.status;
};

/**
 * Apply discount to a price
 */
const applyDiscount = (
  price: number,
  voucher: PlatformVoucherItem | null | undefined,
): number => {
  if (!voucher || price <= 0) return price;

  if (voucher.type === 'PERCENT' && voucher.discountPercent) {
    const discountValue = (price * voucher.discountPercent) / 100;
    const capped =
      voucher.maxDiscountValue !== null && voucher.maxDiscountValue !== undefined
        ? Math.min(discountValue, voucher.maxDiscountValue)
        : discountValue;
    return Math.max(0, price - capped);
  }

  if (voucher.type === 'FIXED' && voucher.discountValue) {
    return Math.max(0, price - voucher.discountValue);
  }

  return price;
};

/**
 * Calculate final price for a product with platform campaigns
 * Based on the detailed documentation provided
 */
export const calculateProductPrice = (
  product: ProductDetail,
  platformCampaigns: PlatformCampaign[],
  selectedVariant: ProductVariant | null = null,
): PriceCalculationResult => {
  // Step 1: Xác định giá gốc (Original Price)
  let originalPrice = 0;
  let basePrices: number[] = [];

  // Case 1: Có variant được chọn
  if (selectedVariant) {
    originalPrice = selectedVariant.variantPrice ?? 0;
    basePrices = [originalPrice];
  }
  // Case 2: Có variants nhưng chưa chọn
  else if (product.variants && product.variants.length > 0) {
    const variantPrices = product.variants
      .map((v) => v.variantPrice ?? 0)
      .filter((p) => p > 0);
    if (variantPrices.length > 0) {
      basePrices = variantPrices;
      originalPrice = Math.min(...variantPrices);
    }
  }
  // Case 3: Không có variants
  else {
    originalPrice = product.price ?? 0;
    basePrices = [originalPrice];
  }

  // Step 2: Kiểm tra xem backend đã tính sẵn giá giảm chưa
  const hasBackendDiscount =
    product.discountPrice !== null &&
    product.discountPrice !== undefined &&
    product.discountPrice < originalPrice;

  // Step 3: Kiểm tra campaign và voucher active
  let discountPercent = 0;
  let campaignBadge: { label: string; color: string } | null = null;
  let activeVoucher: PlatformVoucherItem | null = null;
  const hasCampaign = platformCampaigns.length > 0;

  if (hasCampaign) {
    const activeCampaign = platformCampaigns.find((c) => isActiveCampaign(c));
    if (activeCampaign) {
      activeVoucher = activeCampaign.vouchers?.find((v) => isActiveVoucher(v, activeCampaign)) || null;

      if (activeVoucher) {
        // Calculate discount percent
        if (activeVoucher.type === 'PERCENT' && activeVoucher.discountPercent) {
          discountPercent = activeVoucher.discountPercent;
        } else if (activeVoucher.type === 'FIXED' && activeVoucher.discountValue && originalPrice > 0) {
          discountPercent = Math.round((activeVoucher.discountValue / originalPrice) * 100);
        }

        // Set campaign badge
        const badgeLabel =
          activeCampaign.campaignType === 'MEGA_SALE'
            ? 'MEGA SALE'
            : activeCampaign.campaignType === 'FLASH_SALE'
            ? 'FLASH SALE'
            : activeCampaign.badgeLabel || activeCampaign.campaignType || 'SALE';

        campaignBadge = {
          label: badgeLabel,
          color: activeCampaign.badgeColor || '#FF6600',
        };
      } else if (activeCampaign) {
        // Campaign exists but no active voucher - still show badge if backend has discount
        if (hasBackendDiscount) {
          const badgeLabel =
            activeCampaign.campaignType === 'MEGA_SALE'
              ? 'MEGA SALE'
              : activeCampaign.campaignType === 'FLASH_SALE'
              ? 'FLASH SALE'
              : activeCampaign.badgeLabel || activeCampaign.campaignType || 'SALE';

          campaignBadge = {
            label: badgeLabel,
            color: activeCampaign.badgeColor || '#FF6600',
          };
        }
      }
    } else if (hasCampaign && hasBackendDiscount) {
      // No active campaign but backend has discount - use first campaign for badge
      const firstCampaign = platformCampaigns[0];
      if (firstCampaign) {
        const badgeLabel =
          firstCampaign.campaignType === 'MEGA_SALE'
            ? 'MEGA SALE'
            : firstCampaign.campaignType === 'FLASH_SALE'
            ? 'FLASH SALE'
            : firstCampaign.badgeLabel || firstCampaign.campaignType || 'SALE';

        campaignBadge = {
          label: badgeLabel,
          color: firstCampaign.badgeColor || '#FF6600',
        };
      }
    }
  }

  // Step 4: Xác định giá cuối cùng
  let finalPrice = originalPrice;
  let displayPrice = originalPrice;
  let discountedPrices: number[] = basePrices;

  // Nếu backend đã tính sẵn và cần tính toán lại (chưa có discountPrice hoặc finalPrice khác originalPrice)
  const needsCampaignCalculation =
    !hasBackendDiscount &&
    originalPrice > 0 &&
    hasCampaign &&
    activeVoucher !== null;

  if (needsCampaignCalculation && activeVoucher) {
    // Tính toán discount từ campaign
    discountedPrices = basePrices.map((price) => applyDiscount(price, activeVoucher));
    finalPrice = discountedPrices[0] ?? originalPrice;
    displayPrice = finalPrice;
  } else if (hasBackendDiscount) {
    // Sử dụng giá từ backend
    finalPrice =
      product.discountPrice ??
      product.finalPrice ??
      product.priceAfterPromotion ??
      originalPrice;
    displayPrice = finalPrice;
    // Update discountedPrices for range calculation
    if (basePrices.length === 1) {
      discountedPrices = [finalPrice];
    }
  } else {
    // Không có discount
    finalPrice = originalPrice;
    displayPrice = originalPrice;
    discountedPrices = basePrices;
  }

  // Step 5: Build price range text if needed
  let priceRangeText: string | null = null;
  let discountedPriceRangeText: string | null = null;

  if (basePrices.length > 1) {
    const minPrice = Math.min(...basePrices);
    const maxPrice = Math.max(...basePrices);

    if (minPrice !== maxPrice) {
      priceRangeText = `${formatCurrencyVND(minPrice)} - ${formatCurrencyVND(maxPrice)}`;

      // Calculate discounted range if needed
      if (discountedPrices.length > 1) {
        const minDiscounted = Math.min(...discountedPrices);
        const maxDiscounted = Math.max(...discountedPrices);
        if (minDiscounted !== maxDiscounted) {
          discountedPriceRangeText = `${formatCurrencyVND(minDiscounted)} - ${formatCurrencyVND(maxDiscounted)}`;
        }
      } else if (hasBackendDiscount && basePrices.length > 1) {
        // Use backend discount prices for range
        const backendMin = product.discountPrice ?? product.finalPrice ?? minPrice;
        const backendMax = product.priceAfterPromotion ?? product.finalPrice ?? maxPrice;
        if (backendMin < minPrice || backendMax < maxPrice) {
          discountedPriceRangeText = `${formatCurrencyVND(Math.min(backendMin, minPrice))} - ${formatCurrencyVND(Math.min(backendMax, maxPrice))}`;
        }
      }
    }
  }

  // Step 6: Calculate discount percent if not set
  if (discountPercent === 0 && originalPrice > 0 && finalPrice > 0 && finalPrice < originalPrice) {
    discountPercent = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
  }

  // Step 7: Determine if has discount
  const hasDiscount =
    (activeVoucher !== null && (finalPrice < originalPrice || discountPercent > 0)) ||
    (hasBackendDiscount && finalPrice < originalPrice);

  return {
    originalPrice,
    finalPrice,
    displayPrice,
    priceRangeText,
    discountedPriceRangeText,
    discountPercent,
    campaignBadge,
    hasDiscount,
  };
};

/**
 * Format currency to VND
 */
const formatCurrencyVND = (value: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

