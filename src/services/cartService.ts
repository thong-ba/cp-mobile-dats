import httpClient from '../api/httpClient';
import {
  AddCartItemsRequest,
  AddCartItemsResponse,
  Cart,
  CartResponse,
} from '../types/cart';

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

