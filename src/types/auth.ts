export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResponse = {
  status: number;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    user: {
      email: string;
      fullName: string;
      role: string;
    };
    staff: unknown;
  };
};

export type DecodedToken = {
  sub: string;
  accountId: string;
  customerId: string;
  role: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
};

