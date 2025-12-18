# PHÂN TÍCH DỰ ÁN CP-MOBILE-DATS

## 📋 TỔNG QUAN DỰ ÁN

**Tên dự án:** MobDoAn (CP-Mobile-Dats)  
**Loại:** Ứng dụng mobile e-commerce (React Native + Expo)  
**Phiên bản:** 1.0.0  
**Framework:** Expo SDK ~54.0.20, React Native 0.81.5, React 19.1.0  
**Ngôn ngữ:** TypeScript (strict mode)

---

## 🏗️ KIẾN TRÚC DỰ ÁN

### Cấu trúc thư mục

```
cp-mobile-dats/
├── src/
│   ├── api/              # HTTP Client (Axios)
│   ├── components/        # UI Components
│   │   ├── CommonScreenComponents/
│   │   │   ├── HomeScreenComponents/
│   │   │   ├── LoginComponents/
│   │   │   └── RegisterComponents/
│   │   └── CustomerScreenComponents/
│   │       ├── AddressComponents/
│   │       ├── CartComponents/
│   │       └── OrderScreenComponents/
│   ├── constants/         # Constants (colors, dummy data)
│   ├── context/          # React Context (AuthContext)
│   ├── navigation/       # Navigation configs
│   ├── screens/          # Screen components
│   │   ├── CommonScreens/
│   │   └── CustomerScreens/
│   ├── services/         # Business logic services
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── App.tsx               # Entry point
├── package.json
├── tsconfig.json
└── app.json              # Expo config
```

---

## 🔑 CÁC THÀNH PHẦN CHÍNH

### 1. **Navigation System**

#### Bottom Tab Navigator
- **Home Tab:** Trang chủ (ProductStackNavigator)
- **Notifications Tab:** Thông báo
- **Profile Tab:** Tài khoản (AuthStackNavigator hoặc CustomerStackNavigator tùy trạng thái đăng nhập)

#### Stack Navigators

**AuthStackNavigator:**
- Login
- Register

**ProductStackNavigator:**
- Home
- ProductDetail
- Cart
- Checkout

**CustomerStackNavigator:**
- ProfileMain
- AddressList
- CreateAddress
- EditAddress
- Cart
- Checkout
- Orders
- Notifications

### 2. **Authentication System**

**AuthContext** (`src/context/AuthContext.tsx`):
- Quản lý trạng thái đăng nhập (accessToken, refreshToken, user, customerProfile)
- Persist authentication state với AsyncStorage
- Auto-hydrate khi app khởi động
- JWT token decoding
- Tự động load customer profile sau khi đăng nhập

**Storage Keys:**
- `CUSTOMER_token` - Access token
- `CUSTOMER_refresh_token` - Refresh token
- `customer_user` - User info
- `customer_decoded` - Decoded JWT

### 3. **API Layer**

**HTTP Client** (`src/api/httpClient.ts`):
- Base URL: `https://audioe-commerce-production.up.railway.app/api`
- Timeout: 15 giây
- Auto-inject Authorization header từ environment variable
- Axios instance với interceptors

**Environment Variables:**
- `EXPO_PUBLIC_API_BASE_URL` - API base URL
- `EXPO_PUBLIC_API_TOKEN` - API token (Bearer token)

### 4. **Services Layer**

#### **authService.ts**
- `loginCustomer()` - Đăng nhập customer
- `registerCustomer()` - Đăng ký customer

#### **productService.ts**
- `fetchProducts()` - Lấy danh sách sản phẩm (với pagination, filter)
- `getProductById()` - Lấy chi tiết sản phẩm
- `getProductVouchers()` - Lấy vouchers của sản phẩm

#### **cartService.ts**
- `getCustomerCart()` - Lấy giỏ hàng
- `addItemsToCart()` - Thêm sản phẩm vào giỏ hàng
- `deleteCartItems()` - Xóa items khỏi giỏ hàng
- `checkoutCod()` - Checkout với COD
- `checkoutPayOS()` - Checkout với PayOS

#### **orderService.ts**
- `getCustomerOrders()` - Lấy danh sách đơn hàng (pagination, filter)
- `getCustomerOrderById()` - Lấy chi tiết đơn hàng
- `cancelOrder()` - Hủy đơn hàng (status = PENDING)
- `requestCancelOrder()` - Yêu cầu hủy đơn hàng (status = AWAITING_SHIPMENT)
- `getGhnOrderByStoreOrderId()` - Lấy thông tin GHN tracking
- `createReturnRequest()` - Tạo yêu cầu đổi/trả hàng

#### **customerService.ts**
- `getCustomerById()` - Lấy thông tin customer
- `getCustomerAddresses()` - Lấy danh sách địa chỉ
- `createCustomerAddress()` - Tạo địa chỉ mới
- `updateCustomerAddress()` - Cập nhật địa chỉ
- `deleteCustomerAddress()` - Xóa địa chỉ

#### **ghnService.ts**
- `getProvinces()` / `getActiveProvinces()` - Lấy danh sách tỉnh/thành
- `getDistricts()` / `getActiveDistricts()` - Lấy danh sách quận/huyện
- `getWards()` / `getActiveWards()` - Lấy danh sách phường/xã

#### **voucherService.ts**
- `getShopVouchersByStore()` - Lấy vouchers của shop

#### **notificationService.ts**
- `getNotifications()` - Lấy danh sách thông báo (pagination)
- `markNotificationAsRead()` - Đánh dấu đã đọc
- `getUnreadCount()` - Lấy số lượng thông báo chưa đọc

#### **shippingService.ts**
- (Cần kiểm tra nội dung)

### 5. **Type Definitions**

**auth.ts:**
- LoginRequest, RegisterRequest
- LoginResponse, RegisterResponse
- DecodedToken

**product.ts:**
- ProductStatus, ProductResponseItem, ProductDetail
- ProductVariant, BulkDiscount
- ProductQueryParams, ProductListResponse
- PlatformVoucherItem, PlatformCampaign

**cart.ts:**
- Cart, CartItem, CartStatus
- AddCartItemRequest, AddCartItemsRequest

**order.ts:**
- OrderStatus, CancelReason, ReturnReasonType
- CustomerOrder, StoreOrder, OrderItem
- OrderHistoryRequest, OrderHistoryResponse
- GHNOrder, CreateReturnRequest

**customer.ts:**
- CustomerProfile, CustomerAddress
- CreateCustomerAddressPayload

**checkout.ts:**
- PaymentMethod (COD, PAYOS)
- CheckoutCodRequest, CheckoutPayOSRequest
- CheckoutCodResponse, CheckoutPayOSResponse

**voucher.ts:**
- ShopVoucher, ShopVouchersResponse

**notification.ts:**
- NotificationPageResponse

### 6. **UI Components**

#### HomeScreenComponents:
- `BannerCarousel` - Carousel banner
- `CategoryCard` - Card danh mục
- `CategorySection` - Section danh mục
- `FlashSaleSection` - Section flash sale
- `HomeHeader` - Header trang chủ
- `PopularSection` - Section sản phẩm phổ biến
- `ProductCard` - Card sản phẩm
- `ProductGrid` - Grid sản phẩm
- `RatingSection` - Section đánh giá
- `SearchBar` - Thanh tìm kiếm

#### LoginComponents:
- `LoginForm` - Form đăng nhập

#### RegisterComponents:
- `RegisterForm` - Form đăng ký

#### AddressComponents:
- `AddressForm` - Form địa chỉ
- `AddressList` - Danh sách địa chỉ
- `LocationPicker` - Picker vị trí

#### CartComponents:
- `CartItemList` - Danh sách items trong giỏ hàng

#### OrderScreenComponents:
- `CancelOrderModal` - Modal hủy đơn hàng
- `OrderDetailModal` - Modal chi tiết đơn hàng
- `OrderItemCard` - Card item đơn hàng
- `ReturnRequestModal` - Modal yêu cầu đổi/trả

### 7. **Screens**

#### CommonScreens:
- `HomeScreen` - Trang chủ (hiển thị sản phẩm, categories, banners)
- `LoginScreen` - Màn hình đăng nhập
- `RegisterScreen` - Màn hình đăng ký

#### CustomerScreens:
- `ProductDetailScreen` - Chi tiết sản phẩm
- `CartScreen` - Giỏ hàng
- `CheckoutScreen` - Thanh toán
- `OrderScreen` - Danh sách đơn hàng
- `ProfileScreen` - Hồ sơ người dùng
- `AddressScreen` - Danh sách địa chỉ
- `CreateAddressScreen` - Tạo địa chỉ mới
- `EditAddressScreen` - Chỉnh sửa địa chỉ
- `NotificationsScreen` - Thông báo

---

## 🎨 THEME & STYLING

**Theme Configuration:**
- Primary color: `#FF6A00` (Orange)
- Secondary color: `#FFE0CC`
- Background: `#F7F7F7`
- Surface: `#FFFFFF`

**UI Library:**
- React Native Paper (Material Design 3)
- Expo Vector Icons (MaterialCommunityIcons)

---

## 📦 DEPENDENCIES CHÍNH

### Core:
- `expo` ~54.0.20
- `react` 19.1.0
- `react-native` 0.81.5
- `typescript` ~5.9.2

### Navigation:
- `@react-navigation/native` ^7.1.19
- `@react-navigation/native-stack` ^7.6.1
- `@react-navigation/bottom-tabs` ^7.4.0

### UI:
- `react-native-paper` ^5.14.5
- `@expo/vector-icons` ^15.0.3
- `react-native-snap-carousel` ^3.9.1

### API & Storage:
- `axios` ^1.13.2
- `@react-native-async-storage/async-storage` ^2.2.0
- `base-64` ^1.0.0

### Utilities:
- `react-native-gesture-handler` ~2.28.0
- `react-native-reanimated` ~4.1.1
- `react-native-safe-area-context` ~5.6.0

---

## 🔐 BẢO MẬT

1. **JWT Authentication:**
   - Access token và refresh token
   - Token được lưu trong AsyncStorage
   - Auto-decode JWT để lấy customerId

2. **API Security:**
   - Bearer token authentication
   - Token được inject vào mọi request qua interceptor

3. **Data Persistence:**
   - AsyncStorage cho authentication state
   - Không lưu password

---

## 🚀 TÍNH NĂNG CHÍNH

### 1. **E-commerce Core:**
- ✅ Xem danh sách sản phẩm (pagination, filter, search)
- ✅ Xem chi tiết sản phẩm
- ✅ Quản lý giỏ hàng (thêm, xóa, cập nhật)
- ✅ Checkout (COD và PayOS)
- ✅ Quản lý đơn hàng (xem, hủy, yêu cầu đổi/trả)
- ✅ Tracking đơn hàng qua GHN

### 2. **User Management:**
- ✅ Đăng ký/Đăng nhập
- ✅ Quản lý profile
- ✅ Quản lý địa chỉ (CRUD)
- ✅ Chọn địa chỉ từ GHN API

### 3. **Vouchers & Promotions:**
- ✅ Platform vouchers
- ✅ Shop vouchers
- ✅ Campaign badges

### 4. **Notifications:**
- ✅ Danh sách thông báo
- ✅ Đánh dấu đã đọc
- ✅ Đếm số thông báo chưa đọc

### 5. **Product Features:**
- ✅ Variants (màu sắc, kích thước, etc.)
- ✅ Bulk discounts
- ✅ Rating & reviews
- ✅ Multiple images
- ✅ Video support

---

## 📱 EXPO CONFIGURATION

**app.json:**
- Name: MobDoAn
- Slug: MobDoAn
- Orientation: Portrait
- Scheme: mobdoan
- New Architecture: Enabled
- React Compiler: Enabled (experimental)

**Platforms:**
- iOS: Supports tablet
- Android: Edge-to-edge enabled, predictive back disabled
- Web: Static output

---

## 🔍 ĐIỂM MẠNH

1. **Kiến trúc rõ ràng:**
   - Tách biệt concerns (services, components, screens)
   - Type-safe với TypeScript
   - Dễ maintain và scale

2. **Navigation tốt:**
   - Bottom tabs + Stack navigators
   - Conditional navigation dựa trên auth state

3. **State Management:**
   - Context API cho authentication
   - Local state cho UI

4. **Error Handling:**
   - Try-catch trong services
   - Error messages thân thiện
   - Fallback UI states

5. **Type Safety:**
   - TypeScript strict mode
   - Đầy đủ type definitions
   - Type-safe navigation

---

## ⚠️ ĐIỂM CẦN CẢI THIỆN

1. **State Management:**
   - Chỉ dùng Context cho auth
   - Có thể cần Redux/Zustand cho global state phức tạp hơn

2. **Error Handling:**
   - Chưa có global error boundary
   - Error messages chưa được centralize

3. **Loading States:**
   - Một số screen chưa có loading indicators
   - Có thể cần skeleton loaders

4. **Caching:**
   - Chưa có caching strategy cho API calls
   - Có thể dùng React Query hoặc SWR

5. **Offline Support:**
   - Chưa có offline mode
   - Chưa có queue cho failed requests

6. **Testing:**
   - Chưa thấy test files
   - Cần unit tests và integration tests

7. **Code Organization:**
   - Một số components có thể được tách nhỏ hơn
   - Có thể tạo shared/common components

8. **Performance:**
   - Có thể optimize với React.memo
   - Image optimization (lazy loading)

9. **Documentation:**
   - Cần thêm JSDoc comments
   - API documentation

10. **Environment Variables:**
    - Cần .env.example file
    - Cần validate env vars khi app start

---

## 🛠️ CÔNG CỤ PHÁT TRIỂN

- **Linter:** ESLint với expo config
- **Type Checker:** TypeScript strict mode
- **Package Manager:** npm
- **Build Tool:** Expo CLI

---

## 📊 THỐNG KÊ CODE

- **Services:** 8 files
- **Types:** 9 files
- **Screens:** ~10 screens
- **Components:** ~20+ components
- **Navigation:** 4 navigators

---

## 🎯 KẾT LUẬN

Đây là một dự án e-commerce mobile app được xây dựng tốt với:
- ✅ Kiến trúc rõ ràng và có tổ chức
- ✅ Type-safe với TypeScript
- ✅ Đầy đủ tính năng cơ bản của e-commerce
- ✅ Navigation structure hợp lý
- ✅ Authentication system hoàn chỉnh

**Đề xuất cải thiện:**
1. Thêm testing (unit + integration)
2. Implement caching strategy
3. Thêm offline support
4. Optimize performance
5. Cải thiện error handling
6. Thêm documentation

Dự án đã sẵn sàng cho production với một số cải thiện nhỏ về performance và error handling.

