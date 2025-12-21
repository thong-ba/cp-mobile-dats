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
  variants?: ProductVariant[];
  [key: string]: unknown;
};

export type PlatformVoucherItem = {
  platformVoucherId?: string;
  campaignId?: string;
  type?: 'PERCENT' | 'FIXED';
  discountPercent?: number | null;
  discountValue?: number | null;
  maxDiscountValue?: number | null;
  minOrderValue?: number | null;
  usagePerUser?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string | null;
  slotOpenTime?: string | null;
  slotCloseTime?: string | null;
  slotStatus?: string | null;
};

export type PlatformCampaign = {
  campaignId?: string;
  code?: string;
  name?: string;
  description?: string;
  campaignType?: string | null;
  badgeLabel?: string | null;
  badgeColor?: string | null;
  badgeIconUrl?: string | null;
  status?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  vouchers?: PlatformVoucherItem[];
};

export type ProductVouchersResponse = {
  status: number;
  message: string;
  data: {
    productId?: string;
    name?: string;
    price?: number | null;
    discountPrice?: number | null;
    finalPrice?: number | null;
    brandName?: string;
    categories?: Array<{
      categoryId: string;
      categoryName: string;
    }>;
    thumbnailUrl?: string;
    variants?: unknown[];
    store?: {
      id: string;
      name: string;
      status: string;
      provinceCode?: string;
      districtCode?: string;
      wardCode?: string;
    };
    vouchers: {
      shopVouchers?: unknown[];
      platformVouchers?: PlatformCampaign[];
      shop?: unknown[]; // Backward compatibility
      platform?: PlatformCampaign[]; // Backward compatibility
    };
  };
};

export type ProductListResponse = {
  status: number;
  message: string;
  data: ProductResponseItem[];
};

export type ProductQueryParams = {
  keyword?: string;
  categoryName?: string;
  storeId?: string;
  page?: number;
  size?: number;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
};

export type ProductVariant = {
  variantId: string;
  optionName: string;
  optionValue: string;
  variantPrice: number;
  variantStock: number;
  variantUrl: string;
  variantSku: string;
};

export type BulkDiscount = {
  fromQuantity: number;
  toQuantity: number;
  unitPrice: number;
};

export type ProductDetail = {
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
  model: string;
  color: string;
  material: string;
  dimensions: string;
  weight: number;
  variants: ProductVariant[];
  images: string[];
  videoUrl: string;
  sku: string;
  price: number;
  discountPrice: number | null;
  promotionPercent: number | null;
  priceAfterPromotion: number;
  priceBeforeVoucher: number;
  voucherAmount: number | null;
  finalPrice: number;
  platformFeePercent: number | null;
  currency: string;
  stockQuantity: number;
  warehouseLocation: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  shippingAddress: string;
  shippingFee: number;
  supportedShippingMethodIds: string[];
  bulkDiscounts: BulkDiscount[];
  status: ProductStatus;
  isFeatured: boolean;
  ratingAverage: number | null;
  reviewCount: number | null;
  viewCount: number | null;
  createdAt: string;
  updatedAt: string;
  lastUpdatedAt: string;
  lastUpdateIntervalDays: number;
  createdBy: string;
  updatedBy: string;
  // Audio-specific fields
  frequencyResponse?: string;
  sensitivity?: string;
  impedance?: string;
  powerHandling?: string;
  connectionType?: string;
  voltageInput?: string;
  warrantyPeriod?: string;
  warrantyType?: string;
  manufacturerName?: string;
  manufacturerAddress?: string;
  productCondition?: string;
  isCustomMade?: boolean;
  driverConfiguration?: string;
  driverSize?: string;
  enclosureType?: string;
  coveragePattern?: string;
  crossoverFrequency?: string;
  placementType?: string;
  headphoneType?: string;
  compatibleDevices?: string;
  isSportsModel?: boolean;
  headphoneFeatures?: string;
  batteryCapacity?: string;
  hasBuiltInBattery?: boolean;
  isGamingHeadset?: boolean;
  headphoneAccessoryType?: string;
  headphoneConnectionType?: string;
  plugType?: string;
  sirimApproved?: boolean;
  sirimCertified?: boolean;
  mcmcApproved?: boolean;
  micType?: string;
  polarPattern?: string;
  maxSPL?: string;
  micOutputImpedance?: string;
  micSensitivity?: string;
  amplifierType?: string;
  totalPowerOutput?: string;
  thd?: string;
  snr?: string;
  inputChannels?: number;
  outputChannels?: number;
  supportBluetooth?: boolean;
  supportWifi?: boolean;
  supportAirplay?: boolean;
  platterMaterial?: string;
  motorType?: string;
  tonearmType?: string;
  autoReturn?: boolean;
  dacChipset?: string;
  sampleRate?: string;
  bitDepth?: string;
  balancedOutput?: boolean;
  inputInterface?: string;
  outputInterface?: string;
  channelCount?: number;
  hasPhantomPower?: boolean;
  eqBands?: string;
  faderType?: string;
  builtInEffects?: boolean;
  usbAudioInterface?: boolean;
  midiSupport?: boolean;
};

export type ProductDetailResponse = {
  status: number;
  message: string;
  data: ProductDetail;
};

