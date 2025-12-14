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
 * POST /api/v1/customers/{customerId}/cart/checkout/cod
 * Checkout với COD (Cash on Delivery)
 */
export const checkoutCod = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: CheckoutCodRequest;
}): Promise<CheckoutCodResponse['data']> => {
  const { data } = await httpClient.post<CheckoutCodResponse>(
    `/v1/customers/${customerId}/cart/checkout/cod`,
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
 * POST /api/v1/customers/{customerId}/cart/checkout/payos
 * Checkout với PayOS
 */
export const checkoutPayOS = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: CheckoutPayOSRequest;
}): Promise<CheckoutPayOSResponse['data']> => {
  const { data } = await httpClient.post<CheckoutPayOSResponse>(
    `/v1/customers/${customerId}/cart/checkout/payos`,
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


