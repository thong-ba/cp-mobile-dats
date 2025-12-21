import httpClient from '../api/httpClient';
import {
  AddCartItemsRequest,
  AddCartItemsResponse,
  Cart,
  CartResponse,
  UpdateQuantityRequest,
  UpdateQuantityResponse,
} from '../types/cart';
import {
  CheckoutCodRequest,
  CheckoutCodResponse,
  CheckoutPayOSRequest,
  CheckoutPayOSResponse,
  CheckoutPreviewRequest,
  CheckoutPreviewResponse,
} from '../types/checkout';

type AuthenticatedCustomerRequest = {
  customerId: string;
  accessToken: string;
};

// Throttle logging to once per 90 seconds per key
const lastLogTimeRef: Record<string, number> = {};
const THROTTLE_INTERVAL_MS = 90000; // 90 seconds

const throttledLog = (key: string, logFn: () => void) => {
  const now = Date.now();
  const lastLogTime = lastLogTimeRef[key] || 0;
  
  if (now - lastLogTime >= THROTTLE_INTERVAL_MS) {
    logFn();
    lastLogTimeRef[key] = now;
  }
};

/**
 * GET /api/v1/customers/{customerId}/cart
 * Lấy thông tin giỏ hàng của customer
 */
export const getCustomerCart = async ({
  customerId,
  accessToken,
}: AuthenticatedCustomerRequest): Promise<Cart> => {
  const { data } = await httpClient.get<CartResponse>(`/v1/customers/${customerId}/cart`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
};

/**
 * POST /api/v1/customers/{customerId}/cart/items
 * Thêm sản phẩm vào giỏ hàng
 */
export const addItemsToCart = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: AddCartItemsRequest;
}): Promise<Cart> => {
  const { data } = await httpClient.post<AddCartItemsResponse>(
    `/v1/customers/${customerId}/cart/items`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return data.data;
};

/**
 * POST /api/v1/customers/{customerId}/cart/items/quantity-with-vouchers
 * Cập nhật số lượng sản phẩm trong giỏ hàng (với voucher support)
 */
export const updateQuantityWithVouchers = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: UpdateQuantityRequest;
}): Promise<Cart> => {
  try {
    const response = await httpClient.post<UpdateQuantityResponse | CartResponse>(
      `/v1/customers/${customerId}/cart/items/quantity-with-vouchers`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data;

    // Handle different response formats
    // Format 1: { status, message, data: Cart } - wrapped response
    if (data && typeof data === 'object' && 'data' in data && (data as any).data) {
      const wrappedData = (data as UpdateQuantityResponse).data;
      if (wrappedData && 'cartId' in wrappedData && 'items' in wrappedData) {
        return wrappedData;
      }
    }
    
    // Format 2: Direct Cart object (CartResponse) - same as getCustomerCart
    if (data && typeof data === 'object' && 'cartId' in data && 'items' in data) {
      return data as Cart;
    }

    // Log warning for debugging
    console.warn('[CartService] updateQuantityWithVouchers: Unexpected response format', {
      hasData: 'data' in (data as any),
      hasCartId: 'cartId' in (data as any),
      hasItems: 'items' in (data as any),
      hasStatus: 'status' in (data as any),
      keys: data ? Object.keys(data as any) : [],
      responseKeys: response ? Object.keys(response) : [],
    });

    // Fallback: try to extract from any nested structure
    // @ts-ignore
    const fallback = (data as any)?.data ?? data;
    if (fallback && typeof fallback === 'object' && 'cartId' in fallback) {
      return fallback as Cart;
    }

    throw new Error('Invalid response format from updateQuantityWithVouchers API');
  } catch (error: any) {
    console.error('[CartService] updateQuantityWithVouchers: Error', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      url: error?.config?.url,
      method: error?.config?.method,
      message: error?.message,
      responseData: error?.response?.data,
    });
    throw error;
  }
};

/**
 * DELETE /api/v1/customers/{customerId}/cart/items
 * Xóa các item khỏi giỏ hàng
 */
export const deleteCartItems = async ({
  customerId,
  accessToken,
  cartItemIds,
}: AuthenticatedCustomerRequest & { cartItemIds: string[] }): Promise<Cart> => {
  const { data } = await httpClient.delete<CartResponse | { data: CartResponse }>(
    `/v1/customers/${customerId}/cart/items`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: { cartItemIds }, // axios supports body in DELETE via config.data
    },
  );
  // Some APIs wrap payload in { data, status, message }
  // normalize to Cart shape
  // @ts-ignore
  return (data as any)?.data ?? (data as CartResponse);
};

/**
 * POST /api/v1/customers/{customerId}/cart/checkout-cod
 * Checkout với COD (Cash on Delivery)
 */
export const checkoutCod = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: CheckoutCodRequest;
}): Promise<CheckoutCodResponse['data']> => {
  const endpoint = `/v1/customers/${customerId}/cart/checkout-cod`;
  throttledLog('checkoutCod_request', () => {
    console.log('[CartService] checkoutCod: Request', {
      customerId,
      endpoint,
      payload: {
        itemsCount: payload.items.length,
        addressId: payload.addressId,
        hasStoreVouchers: !!payload.storeVouchers,
        hasPlatformVouchers: !!payload.platformVouchers,
        hasServiceTypeIds: !!payload.serviceTypeIds,
        storeVouchers: payload.storeVouchers,
        platformVouchers: payload.platformVouchers,
      },
    });
  });

  try {
    const { data } = await httpClient.post<CheckoutCodResponse>(
      endpoint,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    throttledLog('checkoutCod_response', () => {
      console.log('[CartService] checkoutCod: Response', {
        status: data.status,
        message: data.message,
        ordersCount: Array.isArray(data.data) ? data.data.length : 0,
        firstOrder: Array.isArray(data.data) && data.data.length > 0 ? {
          orderCode: data.data[0].orderCode,
          grandTotal: data.data[0].grandTotal,
        } : null,
      });
    });

    // Response is now an array of orders
    if (data.data && Array.isArray(data.data)) {
      return data.data;
    }
    throw new Error('Invalid response format from checkout API');
  } catch (error: any) {
    console.error('[CartService] checkoutCod: Error', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      url: error?.config?.url,
      method: error?.config?.method,
      message: error?.message,
      responseData: error?.response?.data,
    });
    throw error;
  }
};

/**
 * POST /api/v1/payos/checkout?customerId={customerId}
 * Checkout với PayOS
 */
export const checkoutPayOS = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: CheckoutPayOSRequest;
}): Promise<CheckoutPayOSResponse['data']> => {
  const endpoint = `/v1/payos/checkout?customerId=${customerId}`;
  throttledLog('checkoutPayOS_request', () => {
    console.log('[CartService] checkoutPayOS: Request', {
      customerId,
      endpoint,
      payload: {
        itemsCount: payload.items.length,
        addressId: payload.addressId,
        hasStoreVouchers: !!payload.storeVouchers,
        hasPlatformVouchers: !!payload.platformVouchers,
        hasServiceTypeIds: !!payload.serviceTypeIds,
        returnUrl: payload.returnUrl,
        cancelUrl: payload.cancelUrl,
      },
    });
  });

  try {
    const { data } = await httpClient.post<CheckoutPayOSResponse>(
      endpoint,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    throttledLog('checkoutPayOS_response', () => {
      console.log('[CartService] checkoutPayOS: Response', {
        status: data.status,
        message: data.message,
        hasData: !!data.data,
        dataKeys: data.data ? Object.keys(data.data) : [],
      });
    });

    // Handle different response formats
    if (data.data) {
      return data.data;
    }
    // If response is directly the data (unlikely but handle it)
    if ((data as any).checkoutUrl || (data as any).orderId || (data as any).orderCode) {
      return (data as any) as CheckoutPayOSResponse['data'];
    }
    throw new Error('Invalid response format from checkout API');
  } catch (error: any) {
    console.error('[CartService] checkoutPayOS: Error', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      url: error?.config?.url,
      method: error?.config?.method,
      message: error?.message,
      responseData: error?.response?.data,
    });
    throw error;
  }
};

/**
 * POST /api/v1/customers/{customerId}/cart/checkout/preview
 * Preview checkout để xem trước thông tin trước khi tạo đơn thực tế
 */
export const checkoutPreview = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: CheckoutPreviewRequest;
}): Promise<CheckoutPreviewResponse['data']> => {
  const endpoint = `/v1/customers/${customerId}/cart/checkout/preview`;
  // Logging disabled - called too frequently
  // console.log('[CartService] checkoutPreview: Request', {
  //   customerId,
  //   endpoint,
  //   payload: {
  //     itemsCount: payload.items.length,
  //     addressId: payload.addressId,
  //     hasStoreVouchers: !!payload.storeVouchers,
  //     hasPlatformVouchers: !!payload.platformVouchers,
  //     hasServiceTypeIds: !!payload.serviceTypeIds,
  //   },
  // });

  try {
    const { data } = await httpClient.post<CheckoutPreviewResponse>(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Customer-Id': customerId,
        'Content-Type': 'application/json',
      },
    });

    // Logging disabled - called too frequently
    // console.log('[CartService] checkoutPreview: Response', {
    //   status: data.status,
    //   message: data.message,
    //   hasData: !!data.data,
    //   overallSubtotal: data.data?.overallSubtotal,
    //   overallShipping: data.data?.overallShipping,
    //   overallDiscount: data.data?.overallDiscount,
    //   overallGrandTotal: data.data?.overallGrandTotal,
    //   storesCount: data.data?.stores?.length,
    // });

    if (data.data) {
      return data.data;
    }

    throw new Error('Invalid response format from checkout preview API');
  } catch (error: any) {
    console.error('[CartService] checkoutPreview: Error', {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      url: error?.config?.url,
      method: error?.config?.method,
      message: error?.message,
      responseData: error?.response?.data,
    });
    throw error;
  }
};
