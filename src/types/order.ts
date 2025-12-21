export type OrderStatus =
  | 'UNPAID'
  | 'CONFIRMED'
  | 'AWAITING_SHIPMENT'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'PENDING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED_WAITING_CONFIRM'
  | 'DELIVERY_SUCCESS'
  | 'DELIVERY_DENIED'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERY_FAIL'
  | 'EXCEPTION'
  | 'RETURNING'
  | 'GHN_CREATED';

export type CancelReason =
  | 'CHANGE_OF_MIND'
  | 'FOUND_BETTER_PRICE'
  | 'WRONG_INFO_OR_ADDRESS'
  | 'ORDERED_BY_ACCIDENT'
  | 'OUT_OF_STOCK'
  | 'DELIVERY_TOO_LONG'
  | 'OTHER';

export type ReturnReasonType =
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'NOT_AS_DESCRIBED'
  | 'DAMAGED'
  | 'OTHER';

export interface OrderItem {
  id: string;
  type: 'PRODUCT' | 'COMBO';
  refId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image?: string;
  storeId: string;
  storeOrderId: string | null;
  storeName: string;
  variantId?: string | null;
  variantOptionName?: string | null;
  variantOptionValue?: string | null;
  variantUrl?: string | null;
}

export interface StoreOrder {
  id: string;
  orderCode: string | null;
  storeId: string;
  storeName: string;
  status: OrderStatus;
  createdAt: string;
  totalAmount: number;
  discountTotal: number;
  shippingFee: number;
  grandTotal: number;
  items: OrderItem[];
}

export interface CustomerOrder {
  id: string;
  orderCode: string | null;
  status: OrderStatus;
  message: string | null;
  createdAt: string;
  totalAmount: number;
  discountTotal: number;
  shippingFeeTotal: number;
  grandTotal: number;
  externalOrderCode: string | null;
  receiverName: string;
  phoneNumber: string;
  country: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  addressLine: string;
  postalCode: string;
  note: string | null;
  storeOrders: StoreOrder[];
  items?: OrderItem[];
}

export interface OrderHistoryRequest {
  page?: number;
  size?: number;
  status?: OrderStatus;
  search?: string;
}

export interface OrderHistoryResponse {
  items?: CustomerOrder[];
  content?: CustomerOrder[];
  totalElements: number;
  totalPages: number;
  page?: number;
  number?: number;
  size: number;
  first?: boolean;
  last?: boolean;
}

export interface GHNOrder {
  id: string;
  storeOrderId: string;
  storeId: string;
  orderGhn: string;
  totalFee: number;
  expectedDeliveryTime: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface GHNOrderResponse {
  status: number;
  message: string;
  data: GHNOrder;
}

export interface CreateReturnRequest {
  orderId: string;
  storeOrderId: string;
  orderItemId: string;
  reasonType: ReturnReasonType;
  reason: string;
  images?: string[];
  video?: string;
}

export interface ReturnRequestResponse {
  status: number;
  message: string;
  data: {
    id: string;
    orderId: string;
    storeOrderId: string;
    orderItemId: string;
    reasonType: ReturnReasonType;
    reason: string;
    status: string;
    images?: string[];
    video?: string;
    createdAt: string;
    updatedAt: string;
  };
}

