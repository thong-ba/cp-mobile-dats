import httpClient from '../api/httpClient';
import {
  AddCartItemsRequest,
  AddCartItemsResponse,
  Cart,
  CartResponse,
} from '../types/cart';
import {
  CheckoutCodRequest,
  CheckoutCodResponse,
  CheckoutPayOSRequest,
  CheckoutPayOSResponse,
} from '../types/checkout';

type AuthenticatedCustomerRequest = {
  customerId: string;
  accessToken: string;
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
 * POST /api/v1/customers/{customerId}/cart/delete-items
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
  console.log('[CartService] checkoutCod: Request', {
    customerId,
    endpoint,
    payload: {
      itemsCount: payload.items.length,
      addressId: payload.addressId,
      hasStoreVouchers: !!payload.storeVouchers,
      hasPlatformVouchers: !!payload.platformVouchers,
      hasServiceTypeIds: !!payload.serviceTypeIds,
    },
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

    console.log('[CartService] checkoutCod: Response', {
      status: data.status,
      message: data.message,
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
    });

    // Handle different response formats
    if (data.data) {
      return data.data;
    }
    // If response is directly the data (unlikely but handle it)
    if ((data as any).orderId || (data as any).orderCode) {
      return (data as any) as CheckoutCodResponse['data'];
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

    console.log('[CartService] checkoutPayOS: Response', {
      status: data.status,
      message: data.message,
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
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


