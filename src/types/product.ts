export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export type ProductResponseItem = {
  productId: string;
  storeId: string;
  storeName: string;
  categoryId: string;
  categoryName: string;
  brandName: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: number | null;
  discountPrice: number | null;
  promotionPercent: number | null;
  priceAfterPromotion: number | null;
  finalPrice: number | null;
  images: string[];
  ratingAverage: number | null;
  reviewCount: number | null;
  status: ProductStatus;
  [key: string]: unknown;
};

export type ProductListResponse = {
  status: number;
  message: string;
  data: ProductResponseItem[];
};

export type ProductQueryParams = {
  keyword?: string;
  categoryName?: string;
  page?: number;
  size?: number;
  status?: ProductStatus;
};

