import httpClient from '../api/httpClient';

/**
 * GET /api/stores/address/default-by-product/{productId}
 * Lấy địa chỉ mặc định của cửa hàng theo productId
 * Dùng để tính phí vận chuyển khi cửa hàng đã thay đổi địa chỉ
 */
export interface StoreDefaultAddressResponse {
  status: number;
  message: string;
  data: {
    addressId: string;
    defaultAddress: boolean;
    provinceCode: string; // "36"
    districtCode: string; // "2603" (GHN district ID)
    wardCode: string; // "260303" (GHN ward code)
    address: string;
    addressLocation: any | null;
  };
}

export const getStoreDefaultAddressByProduct = async (
  productId: string,
): Promise<StoreDefaultAddressResponse['data']> => {
  try {
    const { data } = await httpClient.get<StoreDefaultAddressResponse>(
      `/stores/address/default-by-product/${productId}`,
    );
    return data.data;
  } catch (error: any) {
    // 404 means store address not found, return null
    if (error?.response?.status === 404) {
      return null as any;
    }
    throw error;
  }
};

/**
 * GET /api/stores/{storeId}
 * Lấy thông tin chi tiết cửa hàng
 */
export interface StoreDetailResponse {
  storeId: string;
  storeName: string;
  description: string | null;
  phoneNumber: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  rating: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export const getStoreById = async (storeId: string): Promise<StoreDetailResponse> => {
  try {
    const response = await httpClient.get<any>(`/stores/${storeId}`);
    console.log('[storeService] getStoreById raw response:', response.data);
    
    // Map response to StoreDetailResponse
    const data: StoreDetailResponse = {
      storeId: response.data.storeId || response.data.id || storeId,
      storeName: response.data.storeName || response.data.name || 'Cửa hàng',
      description: response.data.description || null,
      phoneNumber: response.data.phoneNumber || null,
      email: response.data.email || null,
      address: response.data.address || null,
      logoUrl: response.data.logoUrl || response.data.logo || null,
      coverImageUrl: response.data.coverImageUrl || response.data.coverImage || null,
      rating: response.data.rating || null,
      status: response.data.status || 'ACTIVE',
      createdAt: response.data.createdAt || '',
      updatedAt: response.data.updatedAt || '',
    };
    
    console.log('[storeService] getStoreById mapped data:', data);
    return data;
  } catch (error: any) {
    console.error('[storeService] getStoreById error:', error);
    throw error;
  }
};

