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

