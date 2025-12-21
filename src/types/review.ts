export type ReviewStatus = 'VISIBLE' | 'HIDDEN' | 'PENDING';

export type ReviewMediaType = 'IMAGE' | 'VIDEO';

export type ReviewMedia = {
  type: ReviewMediaType;
  url: string;
};

export type ReviewReply = {
  storeName: string;
  content: string;
  createdAt: string;
};

export type Review = {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  customerAvatarUrl: string | null;
  status: ReviewStatus;
  productId: string;
  variantOptionName?: string | null;
  variantOptionValue?: string | null;
  media?: ReviewMedia[];
  replies?: ReviewReply[];
};

export type ReviewPageResponse = {
  content: Review[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      sorted: boolean;
      empty: boolean;
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
    sorted: boolean;
    empty: boolean;
    unsorted: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
};

export type ReviewRequestParams = {
  page?: number;
  size?: number;
};

