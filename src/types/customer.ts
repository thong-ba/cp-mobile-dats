export type CustomerProfile = {
  id: string;
  fullName: string;
  userName: string;
  email: string;
  phoneNumber: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  avatarURL: string | null;
  status: string;
  twoFactorEnabled: boolean;
  kycStatus: string | null;
  lastLogin: string | null;
  addressCount: number;
  loyaltyPoints: number;
  loyaltyLevel: string | null;
  voucherCount: number;
  orderCount: number;
  cancelCount: number;
  returnCount: number;
  unpaidOrderCount: number;
  lastOrderDate: string | null;
  preferredCategory: string | null;
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  receiverName: string;
  phoneNumber: string;
  label: string;
  country: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  addressLine: string;
  postalCode: string;
  note: string | null;
  provinceCode: string;
  districtId: number;
  wardCode: string;
  lat: string | null;
  lng: string | null;
  default: boolean;
};

export type CreateCustomerAddressPayload = {
  receiverName: string;
  phoneNumber: string;
  label: string;
  country: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  addressLine: string;
  postalCode: string;
  note: string | null;
  provinceCode: string;
  districtId: number;
  wardCode: string;
  lat: string | null;
  lng: string | null;
  isDefault: boolean;
};

export type CreateCustomerAddressResponse = {
  status: number;
  message: string;
  data: CustomerAddress;
};

