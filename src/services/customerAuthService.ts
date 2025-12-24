import { RegisterRequest } from '../types/auth';

/**
 * Customer Authentication Service
 * 
 * Handles customer registration and login with:
 * - Client-side validation
 * - API error handling
 * - Error message formatting
 */
export class CustomerAuthService {
  /**
   * Validate register data (client-side)
   */
  static validateRegisterData(data: RegisterRequest): string[] {
    const errors: string[] = [];

    // Name validation
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Tên phải có ít nhất 2 ký tự');
    }

    // Email validation
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Email không hợp lệ');
    }

    // Phone validation: format 84|0[3|5|7|8|9]+([0-9]{8})
    if (!data.phone || !/^(84|0[3|5|7|8|9])+([0-9]{8})$/.test(data.phone)) {
      errors.push('Số điện thoại không hợp lệ');
    }

    // Password validation
    if (!data.password || data.password.length < 6) {
      errors.push('Mật khẩu phải có ít nhất 6 ký tự');
    }

    return errors;
  }

  /**
   * Format API error message
   */
  static formatApiError(error: any): string {
    // Handle network errors
    if (error.status === 0 || !error.response) {
      return 'Lỗi kết nối. Vui lòng kiểm tra internet.';
    }

    const status = error.response?.status || error.status;
    const message = (error.response?.data?.message || error.message || '').toLowerCase();

    // Status 409: Conflict (email/phone already exists)
    if (status === 409) {
      if (message.includes('email') && (message.includes('already') || message.includes('used') || message.includes('exists'))) {
        return 'Email này đã được sử dụng. Vui lòng sử dụng email khác hoặc đăng nhập.';
      }
      if ((message.includes('phone') || message.includes('số điện thoại')) && 
          (message.includes('already') || message.includes('used') || message.includes('exists'))) {
        return 'Số điện thoại này đã được sử dụng. Vui lòng sử dụng số điện thoại khác.';
      }
      return 'Thông tin đăng ký đã tồn tại trong hệ thống. Vui lòng kiểm tra lại email và số điện thoại.';
    }

    // Status 401: Unauthorized (invalid credentials)
    if (status === 401) {
      if (message.includes('invalid') || message.includes('sai') || message.includes('không đúng')) {
        return 'Email hoặc mật khẩu không đúng';
      }
      return 'Thông tin đăng nhập không hợp lệ';
    }

    // Status 403: Forbidden (account not verified)
    if (status === 403) {
      if (message.includes('verify') || message.includes('xác nhận') || message.includes('verified')) {
        return 'Tài khoản chưa được xác nhận. Vui lòng kiểm tra email.';
      }
      return 'Bạn không có quyền truy cập';
    }

    // Status 400: Bad Request (validation error)
    if (status === 400) {
      return error.response?.data?.message || 'Thông tin không hợp lệ. Vui lòng kiểm tra lại.';
    }

    // Status 500: Server Error
    if (status === 500) {
      return 'Lỗi server. Vui lòng thử lại sau.';
    }

    // Default: return API message or generic error
    return error.response?.data?.message || error.message || 'Đã xảy ra lỗi không xác định';
  }

  /**
   * Extract accountId from JWT token
   */
  static extractAccountIdFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Try common keys for accountId
      const possibleKeys = ['accountId', 'account_id', 'accId', 'aid', 'id', 'sub'];
      for (const key of possibleKeys) {
        if (payload[key] !== undefined && payload[key] !== null) {
          return String(payload[key]);
        }
      }
      return null;
    } catch (error) {
      console.error('[CustomerAuthService] Error extracting accountId:', error);
      return null;
    }
  }

  /**
   * Extract customerId from JWT token
   */
  static extractCustomerIdFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Try common keys for customerId
      return payload?.customerId ?? payload?.uid ?? payload?.userId ?? null;
    } catch (error) {
      console.error('[CustomerAuthService] Error extracting customerId:', error);
      return null;
    }
  }
}

