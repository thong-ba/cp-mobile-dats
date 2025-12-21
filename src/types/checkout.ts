export type PaymentMethod = 'COD' | 'PAYOS';

export type CheckoutItemPayload = {
  type: 'PRODUCT' | 'COMBO';
  productId?: string;
  variantId?: string;
  comboId?: string;
  quantity: number;
};

// Legacy type - kept for backward compatibility
export type StoreVoucherPayload = {
  voucherId: string;
  code: string;
  storeId: string;
};

// New type for checkout API - group by storeId with codes array
export type CheckoutStoreVoucherPayload = {
  storeId: string;
  codes: string[];
};

export type PlatformVoucherPayload = {
  campaignProductId: string;
  quantity: number;
  platformVoucherId?: string;
};

export type CheckoutCodRequest = {
  items: CheckoutItemPayload[];
  addressId: string;
  message?: string | null;
  storeVouchers?: CheckoutStoreVoucherPayload[] | null;
  platformVouchers?: PlatformVoucherPayload[] | null;
  serviceTypeIds?: Record<string, number> | null;
};

export type CheckoutPayOSRequest = CheckoutCodRequest & {
  returnUrl: string;
  cancelUrl: string;
};

export type CheckoutCodOrder = {
  id: string;
  orderCode: string;
  status: string;
  message: string;
  createdAt: string;
  storeId: string;
  storeName: string;
  totalAmount: number;
  shippingFeeTotal: number;
  discountTotal: number;
  grandTotal: number;
  storeVoucherDiscount: Record<string, number>;
  platformDiscount: Record<string, number>;
  receiverName: string;
  phoneNumber: string;
  country: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  addressLine: string;
  postalCode: string;
  note: string;
  shippingServiceTypeId: number;
  campaignDiscountTotal: number;
};

export type CheckoutCodResponse = {
  status: number;
  message: string;
  data: CheckoutCodOrder[];
};

export type CheckoutPayOSResponse = {
  status: number;
  message: string;
  data: {
    checkoutUrl: string;
    orderId: string;
    orderCode: string;
  };
};

// Checkout Preview Types
export type CheckoutPreviewItem = {
  productId?: string;
  variantId?: string;
  comboId?: string;
  type: 'PRODUCT' | 'COMBO';
  quantity: number;
};

export type CheckoutPreviewStoreVoucher = {
  storeId: string;
  codes: string[];
};

export type CheckoutPreviewPlatformVoucher = {
  campaignProductId: string;
  quantity: number;
};

export type CheckoutPreviewRequest = {
  items: CheckoutPreviewItem[];
  addressId?: string | null;
  message?: string | null;
  storeVouchers?: CheckoutPreviewStoreVoucher[] | null;
  platformVouchers?: CheckoutPreviewPlatformVoucher[] | null;
  serviceTypeIds?: Record<string, number> | null;
};

export type CheckoutPreviewStoreItem = {
  cartItemId: string;
  type: string;
  refId: string;
  name: string;
  image: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  originProvinceCode?: string;
  originDistrictCode?: string;
  originWardCode?: string;
  variantId?: string | null;
  variantOptionName?: string | null;
  variantOptionValue?: string | null;
  variantUrl?: string | null;
  baseUnitPrice?: number;
  platformCampaignPrice?: number;
  inPlatformCampaign?: boolean;
  campaignUsageExceeded?: boolean;
  campaignRemaining?: number;
  unitPriceBeforeDiscount?: number;
  linePriceBeforeDiscount?: number;
  finalUnitPrice?: number | null;
  finalLineTotal?: number;
};

export type CheckoutPreviewStore = {
  storeId: string;
  storeName: string;
  subtotal: number;
  shippingFee: number;
  platformDiscount: number;
  storeDiscount: number;
  discountTotal: number;
  grandTotal: number;
  storeVoucherDetailJson?: string | null;
  platformVoucherDetailJson?: string | null;
  items: CheckoutPreviewStoreItem[];
  shippingServiceTypeId?: number;
};

export type CheckoutPreviewResponse = {
  status: number;
  message: string;
  data: {
    overallSubtotal: number;
    overallShipping: number;
    overallDiscount: number;
    overallGrandTotal: number;
    stores: CheckoutPreviewStore[];
  };
};

