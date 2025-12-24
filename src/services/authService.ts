import httpClient from '../api/httpClient';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../types/auth';

const LOGIN_ENDPOINT = '/account/login/customer';
const REGISTER_ENDPOINT = '/account/register/customer';
const RESEND_VERIFY_EMAIL_ENDPOINT = '/account/resend-verify-email';
const FORGOT_PASSWORD_ENDPOINT = '/account/forgot-password';
const RESET_PASSWORD_ENDPOINT = '/account/reset-password';

/**
 * Login customer
 */
export const loginCustomer = async (payload: LoginRequest): Promise<LoginResponse> => {
  try {
    const { data } = await httpClient.post<LoginResponse>(LOGIN_ENDPOINT, payload);
    return data;
  } catch (error: any) {
    // Re-throw with formatted error
    throw {
      status: error.response?.status || 0,
      message: error.response?.data?.message || error.message || 'Đăng nhập thất bại',
      response: error.response,
    };
  }
};

/**
 * Register customer
 */
export const registerCustomer = async (payload: RegisterRequest): Promise<RegisterResponse> => {
  try {
    const { data } = await httpClient.post<RegisterResponse>(REGISTER_ENDPOINT, payload);
    return data;
  } catch (error: any) {
    // Re-throw with formatted error
    throw {
      status: error.response?.status || 0,
      message: error.response?.data?.message || error.message || 'Đăng ký thất bại',
      response: error.response,
    };
  }
};

/**
 * Resend verify email
 */
export const resendVerifyEmail = async (
  email: string,
  role: 'CUSTOMER' | 'SELLER' | 'STOREOWNER' = 'CUSTOMER',
): Promise<{ status: number; message: string; data: any }> => {
  try {
    const { data } = await httpClient.post(RESEND_VERIFY_EMAIL_ENDPOINT, { email, role });
    return {
      status: 200,
      message: data?.message || 'Đã gửi lại email xác nhận',
      data: data?.data ?? null,
    };
  } catch (error: any) {
    return {
      status: error.response?.status || 0,
      message: error.response?.data?.message || 'Không thể gửi lại email xác nhận',
      data: null,
    };
  }
};

/**
 * Forgot password
 */
export const forgotPassword = async (email: string): Promise<{ status: number; message: string; data: any }> => {
  try {
    const { data } = await httpClient.post(FORGOT_PASSWORD_ENDPOINT, { email });
    return {
      status: 200,
      message: data?.message || 'Đã gửi email đặt lại mật khẩu',
      data: data?.data ?? null,
    };
  } catch (error: any) {
    return {
      status: error.response?.status || 0,
      message: error.response?.data?.message || 'Không thể gửi email reset',
      data: null,
    };
  }
};

/**
 * Reset password
 */
export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<{ status: number; message: string; data: any }> => {
  try {
    const { data } = await httpClient.post(RESET_PASSWORD_ENDPOINT, { token, newPassword });
    return {
      status: 200,
      message: data?.message || 'Đặt lại mật khẩu thành công',
      data: data?.data ?? null,
    };
  } catch (error: any) {
    return {
      status: error.response?.status || 0,
      message: error.response?.data?.message || 'Không thể đặt lại mật khẩu',
      data: null,
    };
  }
};

