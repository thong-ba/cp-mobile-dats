import httpClient from '../api/httpClient';
import {
    CancelReason,
    CreateReturnRequest,
    CustomerOrder,
    GHNOrderResponse,
    OrderHistoryRequest,
    OrderHistoryResponse,
    ReturnRequestResponse,
} from '../types/order';

type AuthenticatedCustomerRequest = {
  customerId: string;
  accessToken: string;
};

/**
 * GET /api/customers/{customerId}/orders
 * Lấy danh sách đơn hàng với pagination và filter
 */
export const getCustomerOrders = async ({
  customerId,
  accessToken,
  params,
}: AuthenticatedCustomerRequest & {
  params?: OrderHistoryRequest;
}): Promise<{
  data: CustomerOrder[];
  total: number;
  totalPages: number;
  page: number;
  size: number;
}> => {
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;

  const queryParams = new URLSearchParams();
  queryParams.append('page', String(page));
  queryParams.append('size', String(size));

  if (params?.status) {
    queryParams.append('status', params.status);
  }

  const endpoint = `/customers/${customerId}/orders?${queryParams.toString()}`;

  const { data } = await httpClient.get<OrderHistoryResponse>(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // Handle both response formats
  const sourceItems: CustomerOrder[] = (data.items || data.content || []) as CustomerOrder[];
  const normalizedItems = sourceItems.map((order) => normalizeOrder(order));

  // Client-side search (if provided)
  let filteredItems = normalizedItems;
  if (params?.search) {
    const searchTerm = params.search.toLowerCase();
    filteredItems = filteredItems.filter(
      (order) =>
        order.id.toLowerCase().includes(searchTerm) ||
        (order.externalOrderCode &&
          order.externalOrderCode.toLowerCase().includes(searchTerm)) ||
        (order.orderCode && order.orderCode.toLowerCase().includes(searchTerm)),
    );
  }

  const totalElements: number = data.totalElements ?? sourceItems.length ?? 0;
  const totalPages: number = data.totalPages ?? 0;
  const currentPage: number = data.page ?? data.number ?? page;
  const pageSize: number = data.size ?? size;

  return {
    data: filteredItems,
    total: totalElements,
    totalPages,
    page: currentPage,
    size: pageSize,
  };
};

/**
 * GET /api/customers/{customerId}/orders/{orderId}
 * Lấy chi tiết đơn hàng
 */
export const getCustomerOrderById = async ({
  customerId,
  accessToken,
  orderId,
}: AuthenticatedCustomerRequest & {
  orderId: string;
}): Promise<CustomerOrder | null> => {
  const endpoint = `/customers/${customerId}/orders/${orderId}`;

  try {
    const { data } = await httpClient.get<
      CustomerOrder | { status: number; message: string; data: CustomerOrder }
    >(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let order: CustomerOrder | null = null;
    if (data && typeof data === 'object' && 'data' in data) {
      order = (data as { data: CustomerOrder }).data;
    } else {
      order = data as CustomerOrder;
    }

    if (!order) {
      return null;
    }

    return normalizeOrder(order as CustomerOrder & { items?: any[] });
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * POST /api/v1/customers/{customerId}/orders/{orderId}/cancel
 * Hủy đơn hàng (chỉ khi status = PENDING)
 */
export const cancelOrder = async ({
  customerId,
  accessToken,
  orderId,
  reason,
  note,
}: AuthenticatedCustomerRequest & {
  orderId: string;
  reason: CancelReason;
  note?: string;
}): Promise<void> => {
  const query = new URLSearchParams();
  query.append('reason', reason);
  if (note) {
    query.append('note', note);
  }

  const endpoint = `/v1/customers/${customerId}/orders/${orderId}/cancel?${query.toString()}`;

  await httpClient.post<void>(
    endpoint,
    undefined,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
};

/**
 * POST /api/v1/customers/{customerId}/orders/{customerOrderId}/cancel-request
 * Yêu cầu hủy đơn hàng (chỉ khi status = AWAITING_SHIPMENT)
 */
export const requestCancelOrder = async ({
  customerId,
  accessToken,
  orderId,
  reason,
  note,
}: AuthenticatedCustomerRequest & {
  orderId: string;
  reason: CancelReason;
  note?: string;
}): Promise<void> => {
  const query = new URLSearchParams();
  query.append('reason', reason);
  if (note) {
    query.append('note', note);
  }

  const endpoint = `/v1/customers/${customerId}/orders/${orderId}/cancel-request?${query.toString()}`;

  await httpClient.post<void>(
    endpoint,
    undefined,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
};

/**
 * GET /api/v1/ghn-orders/by-store-order/{storeOrderId}
 * Lấy thông tin GHN Order (Tracking)
 */
export const getGhnOrderByStoreOrderId = async ({
  accessToken,
  storeOrderId,
}: {
  accessToken: string;
  storeOrderId: string;
}): Promise<GHNOrderResponse | null> => {
  try {
    const { data } = await httpClient.get<GHNOrderResponse>(
      `/v1/ghn-orders/by-store-order/${storeOrderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return data;
  } catch (error: any) {
    // Return null for 404 or 500 - this is normal when order doesn't have GHN tracking yet
    if (error?.response?.status === 404 || error?.response?.status === 500) {
      return null;
    }
    // Only log unexpected errors
    console.error('[OrderService] Failed to get GHN order:', error);
    return null;
  }
};

/**
 * POST /api/customers/me/returns
 * Tạo Return Request
 */
export const createReturnRequest = async ({
  accessToken,
  payload,
}: {
  accessToken: string;
  payload: CreateReturnRequest;
}): Promise<ReturnRequestResponse> => {
  const { data } = await httpClient.post<ReturnRequestResponse>(
    `/customers/me/returns`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return data;
};

/**
 * Normalize order response - map items from root level into storeOrders if needed
 */
function normalizeOrder(order: CustomerOrder & { items?: any[] }): CustomerOrder {
  const rootItems = Array.isArray(order.items) ? order.items : [];
  const storeOrders = Array.isArray(order.storeOrders) ? order.storeOrders : [];

  // If we have both storeOrders and root items, map items into storeOrders
  if (storeOrders.length > 0 && rootItems.length > 0) {
    const hasItemsInStoreOrders = storeOrders.some(
      (so) => Array.isArray(so.items) && so.items.length > 0,
    );

    if (!hasItemsInStoreOrders) {
      // Map root items to storeOrders based on storeOrderId
      const storeOrdersWithItems = storeOrders.map((storeOrder) => {
        const itemsForStoreOrder = rootItems
          .filter((item) => item.storeOrderId === storeOrder.id)
          .map((item: any, index: number) => {
            const displayImage = getPreferredItemImage(item);
            return {
              id: item.id || `${order.id}-item-${index + 1}`,
              type: item.type || 'PRODUCT',
              refId: item.refId || item.productId || item.id,
              name: item.name || 'Sản phẩm',
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? 0,
              lineTotal: item.lineTotal ?? (item.unitPrice ?? 0) * (item.quantity ?? 1),
              image: displayImage,
              storeId: item.storeId || storeOrder.storeId,
              storeOrderId: item.storeOrderId ?? storeOrder.id,
              storeName: item.storeName || storeOrder.storeName,
              variantId: item.variantId ?? null,
              variantOptionName: item.variantOptionName ?? null,
              variantOptionValue: item.variantOptionValue ?? null,
              variantUrl: item.variantUrl ?? null,
            };
          });

        return {
          ...storeOrder,
          items: itemsForStoreOrder,
        };
      });

      return {
        ...order,
        storeOrders: storeOrdersWithItems,
      };
    }
  }

  return order;
}

/**
 * Get preferred image for order item (variant image > product image)
 */
function getPreferredItemImage(item: any): string | undefined {
  if (item.variantUrl) {
    return item.variantUrl;
  }
  if (item.image) {
    return item.image;
  }
  return undefined;
}

