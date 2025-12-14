export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  actionUrl: string | null;
  metadataJson: string | null;
  createdAt: string | null;
}

export interface NotificationPageResponse {
  content: Notification[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalElements: number;
  totalPages: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface NotificationMetadata {
  orderId?: string;
  orderCode?: string;
  storeId?: string;
  storeName?: string;
  productId?: string;
  productName?: string;
  [key: string]: any;
}

export const getNotificationTypeLabel = (type: string): string => {
  const typeMap: Record<string, string> = {
    NEW_ORDER: 'Đơn hàng mới',
    ORDER_CANCELLED: 'Đơn hàng hủy',
    ORDER_SHIPPED: 'Đơn hàng đang giao',
    ORDER_DELIVERED: 'Đơn hàng đã giao',
    ORDER_COMPLETED: 'Đơn hàng hoàn tất',
    PAYMENT_SUCCESS: 'Thanh toán thành công',
    PAYMENT_FAILED: 'Thanh toán thất bại',
    VOUCHER: 'Mã giảm giá',
    PROMOTION: 'Khuyến mãi',
    SYSTEM: 'Hệ thống',
  };
  return typeMap[type] || type;
};

export const formatNotificationDate = (dateString: string | null): string => {
  if (!dateString) return 'Vừa xong';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Vừa xong';
  }
};

