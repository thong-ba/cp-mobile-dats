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

