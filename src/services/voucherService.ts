import httpClient from '../api/httpClient';
import { ShopVoucher, ShopVouchersResponse } from '../types/voucher';

type AuthenticatedCustomerRequest = {
  customerId: string;
  accessToken: string;
};

/**
 * GET /api/v1/stores/{storeId}/vouchers
 * Lấy vouchers của shop theo storeId
 * @param storeId - ID của store
 * @param status - Trạng thái voucher (ACTIVE, INACTIVE, etc.)
 * @param scope - Phạm vi voucher (PRODUCT, ALL_SHOP_VOUCHER)
 */
export const getShopVouchersByStore = async (
  storeId: string,
  status: string = 'ACTIVE',
  scope?: string,
): Promise<ShopVoucher[]> => {
  if (!storeId) {
    return [];
  }
  try {
    const params: Record<string, any> = { status };
    if (scope) {
      params.scope = scope;
    }
    const { data } = await httpClient.get<ShopVouchersResponse>(
      `/v1/stores/${storeId}/vouchers`,
      { params },
    );
    return data.data || [];
  } catch (error: any) {
    // 404 means no vouchers available, not an error
    if (error?.response?.status === 404) {
      return [];
    }
    // Only log non-404 errors
    if (error?.response?.status !== 404) {
      console.error('[VoucherService] getShopVouchersByStore failed', error);
    }
    return [];
  }
};

