import httpClient from '../api/httpClient';
import { CartItem } from '../types/cart';

export type ProductCacheItem = {
  productId: string;
  storeId: string;
  storeName: string;
  weight: number; // kg
  districtCode: string;
  wardCode: string;
};

// GHN API Types
export type GHNFeeItem = {
  name: string;
  quantity: number;
  length: number; // cm
  width: number; // cm
  height: number; // cm
  weight: number; // grams
};

export type GHNFeeRequest = {
  service_type_id?: 2 | 5;
  from_district_id?: number;
  from_ward_code?: string;
  to_district_id: number;
  to_ward_code: string;
  length?: number; // cm
  width?: number; // cm
  height?: number; // cm
  weight: number; // grams
  insurance_value?: number;
  coupon?: string | null;
  items?: GHNFeeItem[];
};

export type GHNFeeResponse = {
  code: number; // 200 = success
  message: string;
  data: {
    total: number;
    service_fee: number; // VND - DÙNG CÁI NÀY
    insurance_fee: number;
    pick_station_fee: number;
    coupon_value: number;
    r2s_fee: number;
    return_again: number;
    document_return: number;
    double_check: number;
    cod_fee: number;
    pick_remote_areas_fee: number;
    deliver_remote_areas_fee: number;
    cod_failed_fee: number;
  };
};

export type ShippingFeeResult = {
  totalFee: number;
  storeFees: Record<string, number>; // storeId -> fee
  storeNames: Record<string, string>; // storeId -> storeName
};

/**
 * POST /api/ghn/fee
 * Tính phí ship GHN cho một store
 * Headers: Authorization: Bearer {accessToken}
 */
export const calculateGHNFee = async (
  request: GHNFeeRequest,
  accessToken?: string,
): Promise<number> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    
    const { data } = await httpClient.post<GHNFeeResponse>('/ghn/fee', request, { headers });
    
    if (data.code === 200 && data.data) {
      return data.data.service_fee || 0;
    }
    throw new Error(data.message || 'Failed to calculate shipping fee');
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return 0; // Service not available
    }
    throw error;
  }
};

/**
 * Tính service type (2 hoặc 5) dựa trên tổng cân nặng
 * - serviceTypeId = 2: nếu tổng cân nặng <= 7500g (7.5kg)
 * - serviceTypeId = 5: nếu tổng cân nặng > 7500g
 */
export const calculateServiceType = (
  items: CartItem[],
  productCache: Record<string, ProductCacheItem>,
): number => {
  const totalWeightGrams = calculateTotalWeightGrams(items, productCache);
  return totalWeightGrams <= 7500 ? 2 : 5;
};

/**
 * Tính tổng weight (grams) từ items
 */
export const calculateTotalWeightGrams = (
  items: CartItem[],
  productCache: Record<string, ProductCacheItem>,
): number => {
  const DEFAULT_WEIGHT_KG = 0.5;
  const totalWeightKg = items.reduce((sum, item) => {
    const cache = productCache[item.refId];
    const weightKg = cache?.weight ?? DEFAULT_WEIGHT_KG;
    return sum + weightKg * item.quantity;
  }, 0);
  return Math.ceil(totalWeightKg * 1000); // Convert to grams
};

/**
 * Build GHN items từ cart items
 */
export const buildGHNItems = (
  items: CartItem[],
  productCache: Record<string, ProductCacheItem>,
): GHNFeeItem[] => {
  const DEFAULT_DIMENSIONS = { length: 20, width: 15, height: 10 }; // cm
  const DEFAULT_WEIGHT_KG = 0.5;

  return items.map((item) => {
    const cache = productCache[item.refId];
    const weightKg = cache?.weight ?? DEFAULT_WEIGHT_KG;
    
    return {
      name: item.name,
      quantity: item.quantity,
      length: DEFAULT_DIMENSIONS.length,
      width: DEFAULT_DIMENSIONS.width,
      height: DEFAULT_DIMENSIONS.height,
      weight: Math.ceil(weightKg * 1000), // Convert to grams
    };
  });
};
