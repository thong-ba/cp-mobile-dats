export type PaymentMethod = 'COD' | 'PAYOS';

export type CheckoutItemPayload = {
  type: 'PRODUCT' | 'COMBO';
  productId?: string;
  variantId?: string;
  comboId?: string;
  quantity: number;
};

export type StoreVoucherPayload = {
  voucherId: string;
  code: string;
  storeId: string;
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
  storeVouchers?: StoreVoucherPayload[] | null;
  platformVouchers?: PlatformVoucherPayload[] | null;
  serviceTypeIds?: Record<string, number> | null;
};

export type CheckoutPayOSRequest = CheckoutCodRequest & {
  returnUrl: string;
  cancelUrl: string;
};

export type CheckoutCodResponse = {
  status: number;
  message: string;
  data: {
    orderId: string;
    orderCode: string;
    totalAmount: number;
  };
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

