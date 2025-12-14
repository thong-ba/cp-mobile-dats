export type VoucherStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'USED';

export type VoucherType = 'PERCENT' | 'FIXED';

export type ShopVoucher = {
  voucherId: string;
  code: string;
  name: string;
  description?: string;
  type: VoucherType;
  discountPercent?: number | null;
  discountValue?: number | null;
  maxDiscountValue?: number | null;
  minOrderValue?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  status: VoucherStatus;
  storeId: string;
  storeName?: string;
  usageLimit?: number | null;
  usedCount?: number | null;
  scope?: 'PRODUCT' | 'ALL_SHOP_VOUCHER';
  productIds?: string[];
};

export type ShopVouchersResponse = {
  status: number;
  message: string;
  data: ShopVoucher[];
};

export type AppliedStoreVoucher = {
  voucherId: string;
  code: string;
  storeId: string;
  discountValue: number;
  type: VoucherType;
};

export type AppliedStoreWideVoucher = {
  voucherId: string;
  code: string;
  storeId: string;
  discountValue: number;
  type: VoucherType;
};

export type PlatformVoucherDiscount = {
  discount: number;
  campaignProductId: string;
  inPlatformCampaign?: boolean;
  platformVoucherId?: string;
};

