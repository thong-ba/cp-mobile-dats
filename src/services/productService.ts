import httpClient from '../api/httpClient';
import {
  ProductDetail,
  ProductDetailResponse,
  ProductListResponse,
  ProductQueryParams,
  ProductStatus,
  ProductVouchersResponse,
} from '../types/product';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_STATUS: ProductStatus = 'ACTIVE';

export const fetchProducts = async (
  params: ProductQueryParams = {},
): Promise<ProductListResponse> => {
  const query: Record<string, any> = {
    page: params.page ?? 0,
    size: params.size ?? DEFAULT_PAGE_SIZE,
    status: params.status ?? DEFAULT_STATUS,
  };

  // Only include optional params if they have values
  if (params.keyword?.trim()) {
    query.keyword = params.keyword.trim();
  }
  if (params.categoryName?.trim()) {
    query.categoryName = params.categoryName.trim();
  }
  if (params.storeId?.trim()) {
    query.storeId = params.storeId.trim();
  }
  if (params.minPrice !== undefined && params.minPrice !== null) {
    query.minPrice = params.minPrice;
  }
  if (params.maxPrice !== undefined && params.maxPrice !== null) {
    query.maxPrice = params.maxPrice;
  }

  const { data } = await httpClient.get<ProductListResponse>('/products', {
    params: query,
  });

  return data;
};

/**
 * GET /api/products/{productId}
 * Lấy chi tiết sản phẩm theo ID
 */
export const getProductById = async (productId: string): Promise<ProductDetail> => {
  const { data } = await httpClient.get<ProductDetailResponse>(`/products/${productId}`);
  return data.data;
};

/**
 * GET /api/products/view/{productId}/vouchers?type=ALL
 * Lấy voucher platform/shop của sản phẩm
 */
export const getProductVouchers = async (
  productId: string,
): Promise<ProductVouchersResponse['data']> => {
  const { data } = await httpClient.get<ProductVouchersResponse>(
    `/products/view/${productId}/vouchers`,
    {
      params: {
        type: 'ALL',
      },
    },
  );
  return data.data;
};

