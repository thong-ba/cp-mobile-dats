import httpClient from '../api/httpClient';
import {
    ProductListResponse,
    ProductQueryParams,
    ProductStatus,
} from '../types/product';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_STATUS: ProductStatus = 'ACTIVE';

export const fetchProducts = async (
  params: ProductQueryParams = {},
): Promise<ProductListResponse> => {
  const query: ProductQueryParams = {
    page: params.page ?? 0,
    size: params.size ?? DEFAULT_PAGE_SIZE,
    status: params.status ?? DEFAULT_STATUS,
    keyword: params.keyword?.trim() || undefined,
    categoryName: params.categoryName?.trim() || undefined,
  };

  const { data } = await httpClient.get<ProductListResponse>('/products', {
    params: query,
  });

  return data;
};

