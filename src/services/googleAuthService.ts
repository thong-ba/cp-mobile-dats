import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { DecodedToken } from '../types/auth';
import { CustomerProfile } from '../types/customer';
import { decodeJwt } from '../utils/jwt';
import { getCustomerById } from './customerService';

// Complete auth session
WebBrowser.maybeCompleteAuthSession();

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://audioe-commerce-production.up.railway.app';
const OAUTH_ENDPOINT = `${API_BASE_URL}/oauth2/authorization/google`;

export type OAuthTokens = {
  token: string;
  refreshToken?: string;
  accountId: string;
  customerId?: string;
};

export type OAuthCallbackParams = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  accountId?: string;
  customerId?: string;
  error?: string;
};

/**
 * Extract OAuth parameters from URL
 * Supports query params, hash fragment, and cookies (for web)
 */
export const extractOAuthParams = (url: string): OAuthCallbackParams => {
  const params: OAuthCallbackParams = {};

  try {
    const urlObj = new URL(url);

    // Extract from query params
    urlObj.searchParams.forEach((value, key) => {
      if (key === 'token' || key === 'accessToken') {
        params.token = value;
        params.accessToken = value;
      } else if (key === 'refreshToken') {
        params.refreshToken = value;
      } else if (key === 'accountId') {
        params.accountId = value;
      } else if (key === 'customerId') {
        params.customerId = value;
      } else if (key === 'error') {
        params.error = value;
      }
    });

    // Extract from hash fragment
    if (urlObj.hash) {
      const hashParams = new URLSearchParams(urlObj.hash.substring(1));
      hashParams.forEach((value, key) => {
        if (key === 'token' || key === 'accessToken') {
          params.token = value;
          params.accessToken = value;
        } else if (key === 'refreshToken') {
          params.refreshToken = value;
        } else if (key === 'accountId') {
          params.accountId = value;
        } else if (key === 'customerId') {
          params.customerId = value;
        } else if (key === 'error') {
          params.error = value;
        }
      });
    }
  } catch (error) {
    console.error('[GoogleAuthService] Failed to parse URL:', error);
  }

  return params;
};

/**
 * Get OAuth authorization URL
 */
export const getGoogleOAuthUrl = (): string => {
  const timestamp = Date.now();
  return `${OAUTH_ENDPOINT}?t=${timestamp}`;
};

/**
 * Start Google OAuth flow
 * Opens browser for OAuth authentication
 */
export const startGoogleOAuth = async (): Promise<OAuthCallbackParams> => {
  try {
    const redirectUri = Linking.createURL('/oauth2/success', {
      scheme: 'mobdoan',
    });

    console.log('[GoogleAuthService] Starting OAuth flow', {
      oauthUrl: OAUTH_ENDPOINT,
      redirectUri,
    });

    const result = await WebBrowser.openAuthSessionAsync(OAUTH_ENDPOINT, redirectUri);

    if (result.type === 'success' && result.url) {
      const params = extractOAuthParams(result.url);
      console.log('[GoogleAuthService] OAuth success', {
        hasToken: !!params.token,
        hasAccountId: !!params.accountId,
        hasError: !!params.error,
      });
      return params;
    } else if (result.type === 'cancel') {
      console.log('[GoogleAuthService] OAuth cancelled by user');
      return { error: 'User cancelled OAuth' };
    } else {
      console.warn('[GoogleAuthService] OAuth failed', result);
      return { error: 'OAuth authentication failed' };
    }
  } catch (error: any) {
    console.error('[GoogleAuthService] OAuth error:', error);
    return { error: error?.message || 'Failed to start OAuth flow' };
  }
};

/**
 * Fetch customer profile using multiple endpoints as fallback
 */
export const fetchCustomerProfile = async (
  token: string,
  customerId?: string,
): Promise<CustomerProfile | null> => {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: '*/*',
  };

  // Try 1: /api/customers/{customerId}
  if (customerId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${customerId}`, {
        headers,
      });
      if (response.ok) {
        const profile = await response.json();
        console.log('[GoogleAuthService] Profile fetched from /api/customers/{customerId}');
        return profile;
      }
    } catch (error) {
      console.warn('[GoogleAuthService] Failed to fetch from /api/customers/{customerId}', error);
    }
  }

  // Try 2: /api/customer/profile
  try {
    const response = await fetch(`${API_BASE_URL}/api/customer/profile`, {
      headers,
    });
    if (response.ok) {
      const profile = await response.json();
      console.log('[GoogleAuthService] Profile fetched from /api/customer/profile');
      return profile;
    }
  } catch (error) {
    console.warn('[GoogleAuthService] Failed to fetch from /api/customer/profile', error);
  }

  // Try 3: Use customerService.getCustomerById if we have customerId
  if (customerId) {
    try {
      const profile = await getCustomerById({
        customerId,
        accessToken: token,
      });
      console.log('[GoogleAuthService] Profile fetched from customerService');
      return profile;
    } catch (error) {
      console.warn('[GoogleAuthService] Failed to fetch from customerService', error);
    }
  }

  return null;
};

/**
 * Extract user info from JWT token as fallback
 */
export const extractUserInfoFromToken = (
  token: string,
  accountId?: string,
  customerId?: string,
): {
  email: string;
  fullName: string;
  role: string;
  accountId: string;
  customerId: string;
} | null => {
  try {
    const decoded = decodeJwt(token) as DecodedToken & { sub?: string; email?: string };
    const email = decoded.email || decoded.sub?.split(':')[0] || '';
    const nameFromEmail = email.split('@')[0] || `User_${accountId?.slice(-6) || 'Unknown'}`;

    return {
      email,
      fullName: nameFromEmail,
      role: decoded.role || 'CUSTOMER',
      accountId: accountId || decoded.accountId || '',
      customerId: customerId || decoded.customerId || '',
    };
  } catch (error) {
    console.error('[GoogleAuthService] Failed to decode token:', error);
    return null;
  }
};

