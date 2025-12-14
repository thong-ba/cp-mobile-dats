export type CartStatus = 'ACTIVE' | 'ABANDONED' | 'COMPLETED';

export type CartItem = {
  cartItemId: string;
  type: 'PRODUCT' | 'VOUCHER' | 'OTHER';
  refId: string;
  name: string;
  image: string;
  quantity: number;
  unitPrice: number; // current unit price after campaign/voucher if any
  baseUnitPrice?: number | null; // original price before platform campaign
  platformCampaignPrice?: number | null; // price after platform campaign (if provided)
  inPlatformCampaign?: boolean;
  campaignUsageExceeded?: boolean;
  campaignRemaining?: number | null;
  lineTotal: number;
  originProvinceCode: string;
  originDistrictCode: string;
  originWardCode: string;
  variantId: string | null;
  variantOptionName: string | null;
  variantOptionValue: string | null;
  variantUrl: string | null;
};

export type Cart = {
  cartId: string;
  customerId: string;
  status: CartStatus;
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  items: CartItem[];
};

export type CartResponse = Cart;

export type AddCartItemRequest = {
  type: 'PRODUCT' | 'VOUCHER' | 'COMBO';
  productId?: string;
  variantId?: string;
  comboId?: string;
  quantity: number;
};

export type AddCartItemsRequest = {
  items: AddCartItemRequest[];
};

export type AddCartItemsResponse = {
  status: number;
  message: string;
  data: Cart;
};

