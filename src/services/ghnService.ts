import httpClient from '../api/httpClient';

// Types
export interface Province {
  ProvinceID: number;
  ProvinceName: string;
  CountryID: number;
  Code: string;
  NameExtension: string[];
  IsEnable: number;
  RegionID: number;
  RegionCPN: number;
  UpdatedBy: number;
  CreatedAt: string;
  UpdatedAt: string;
  AreaID: number;
  CanUpdateCOD: boolean;
  Status: number;
  UpdatedEmployee: number;
  UpdatedSource: string;
  UpdatedDate: string;
}

export interface District {
  DistrictID: number;
  ProvinceID: number;
  DistrictName: string;
  Code: string;
  Type: number;
  SupportType: number;
  NameExtension: string[];
  IsEnable: number;
  CanUpdateCOD: boolean;
  Status: number;
  PickType: number;
  DeliverType: number;
}

export interface Ward {
  WardCode: string;
  DistrictID: number;
  WardName: string;
  NameExtension: string[];
  CanUpdateCOD: boolean;
  SupportType: number;
  PickType: number;
  DeliverType: number;
  Status: number;
}

export interface ProvinceListResponse {
  code: number;
  message: string;
  data: Province[];
}

export interface DistrictListResponse {
  code: number;
  message: string;
  data: District[];
}

export interface WardListResponse {
  code: number;
  message: string;
  data: Ward[];
}

export interface DistrictRequest {
  province_id: number;
}

export interface WardRequest {
  district_id: number;
}

/**
 * GET /api/ghn/provinces
 * Lấy danh sách tỉnh/thành phố
 */
export const getProvinces = async (): Promise<ProvinceListResponse> => {
  try {
    const response = await httpClient.get<ProvinceListResponse>('/ghn/provinces');
    return response.data;
  } catch (error) {
    console.error('[GhnService] Failed to fetch provinces:', error);
    throw new Error('Không thể tải danh sách tỉnh. Vui lòng thử lại.');
  }
};

/**
 * Lấy danh sách tỉnh/thành phố đang hoạt động (IsEnable=1, Status=1), sắp xếp theo tên
 */
export const getActiveProvinces = async (): Promise<Province[]> => {
  const response = await getProvinces();
  const activeProvinces = response.data.filter(
    (province) => province.IsEnable === 1 && province.Status === 1,
  );
  return activeProvinces.sort((a, b) =>
    a.ProvinceName.localeCompare(b.ProvinceName, 'vi'),
  );
};

/**
 * POST /api/ghn/districts
 * Lấy danh sách quận/huyện theo tỉnh
 */
export const getDistricts = async (provinceId: number): Promise<DistrictListResponse> => {
  try {
    const requestData: DistrictRequest = { province_id: provinceId };
    const response = await httpClient.post<DistrictListResponse>('/ghn/districts', requestData);
    return response.data;
  } catch (error) {
    console.error('[GhnService] Failed to fetch districts:', error);
    throw new Error('Không thể tải danh sách quận/huyện. Vui lòng thử lại.');
  }
};

/**
 * Lấy danh sách quận/huyện đang hoạt động (IsEnable=1, Status=1), sắp xếp theo tên
 */
export const getActiveDistricts = async (provinceId: number): Promise<District[]> => {
  const response = await getDistricts(provinceId);
  const activeDistricts = response.data.filter(
    (district) => district.IsEnable === 1 && district.Status === 1,
  );
  return activeDistricts.sort((a, b) =>
    a.DistrictName.localeCompare(b.DistrictName, 'vi'),
  );
};

/**
 * POST /api/ghn/wards
 * Lấy danh sách phường/xã theo quận/huyện
 */
export const getWards = async (districtId: number): Promise<WardListResponse> => {
  try {
    const requestData: WardRequest = { district_id: districtId };
    const response = await httpClient.post<WardListResponse>('/ghn/wards', requestData);
    return response.data;
  } catch (error) {
    console.error('[GhnService] Failed to fetch wards:', error);
    throw new Error('Không thể tải danh sách phường/xã. Vui lòng thử lại.');
  }
};

/**
 * Lấy danh sách phường/xã đang hoạt động (Status=1), sắp xếp theo tên
 */
export const getActiveWards = async (districtId: number): Promise<Ward[]> => {
  const response = await getWards(districtId);
  const activeWards = response.data.filter((ward) => ward.Status === 1);
  return activeWards.sort((a, b) => a.WardName.localeCompare(b.WardName, 'vi'));
};

