import httpClient from '../api/httpClient';
import { ReviewPageResponse, ReviewRequestParams } from '../types/review';

/**
 * GET /api/reviews/product/{productId}
 * Lấy danh sách reviews của sản phẩm
 */
export const getProductReviews = async (
  productId: string,
  params?: ReviewRequestParams,
): Promise<ReviewPageResponse> => {
  const page = params?.page ?? 0;
  const size = params?.size ?? 10;

  const queryParams = new URLSearchParams();
  queryParams.append('page', String(page));
  queryParams.append('size', String(size));

  const endpoint = `/reviews/product/${productId}?${queryParams.toString()}`;

  const { data } = await httpClient.get<ReviewPageResponse>(endpoint);

  return data;
};

