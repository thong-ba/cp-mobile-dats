import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginCustomer } from '../services/authService';
import { CustomerAuthService } from '../services/customerAuthService';
import { getCustomerById } from '../services/customerService';
import { DecodedToken, LoginRequest, LoginResponse } from '../types/auth';
import { CustomerProfile } from '../types/customer';
import { decodeJwt } from '../utils/jwt';

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: LoginResponse['data']['user'] | null;
  decodedToken: DecodedToken | null;
  customerProfile: CustomerProfile | null;
};

const initialState: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  decodedToken: null,
  customerProfile: null,
};

const STORAGE_KEYS = {
  accessToken: 'CUSTOMER_token',
  refreshToken: 'CUSTOMER_refresh_token',
  tokenType: 'CUSTOMER_tokenType',
  user: 'customer_user',
  decoded: 'customer_decoded',
  accountId: 'accountId',
  customerId: 'customerId',
};

type AuthContextValue = {
  authState: AuthState;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<LoginResponse['data']>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AsyncStorage: any =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@react-native-async-storage/async-storage').default;

const persistAuthState = async (state: AuthState) => {
  // Extract accountId and customerId from token or decoded token
  let accountId = state.decodedToken?.accountId || null;
  let customerId = state.decodedToken?.customerId || null;

  // If not in decoded token, try to extract from accessToken
  if (!accountId && state.accessToken) {
    accountId = CustomerAuthService.extractAccountIdFromToken(state.accessToken);
  }
  if (!customerId && state.accessToken) {
    customerId = CustomerAuthService.extractCustomerIdFromToken(state.accessToken);
  }

  await AsyncStorage.multiSet([
    [STORAGE_KEYS.accessToken, state.accessToken ?? ''],
    [STORAGE_KEYS.refreshToken, state.refreshToken ?? ''],
    [STORAGE_KEYS.tokenType, 'Bearer'],
    [STORAGE_KEYS.user, state.user ? JSON.stringify(state.user) : ''],
    [STORAGE_KEYS.decoded, state.decodedToken ? JSON.stringify(state.decodedToken) : ''],
    [STORAGE_KEYS.accountId, accountId ?? ''],
    [STORAGE_KEYS.customerId, customerId ?? ''],
  ]);
};

const clearPersistedAuthState = async () => {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.tokenType,
    STORAGE_KEYS.user,
    STORAGE_KEYS.decoded,
    STORAGE_KEYS.accountId,
    STORAGE_KEYS.customerId,
  ]);
};

const readPersistedAuthState = async (): Promise<AuthState> => {
  const entries = await AsyncStorage.multiGet([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.tokenType,
    STORAGE_KEYS.user,
    STORAGE_KEYS.decoded,
    STORAGE_KEYS.accountId,
    STORAGE_KEYS.customerId,
  ]);
  const map = Object.fromEntries(entries);
  return {
    accessToken: map[STORAGE_KEYS.accessToken] || null,
    refreshToken: map[STORAGE_KEYS.refreshToken] || null,
    user: map[STORAGE_KEYS.user] ? JSON.parse(map[STORAGE_KEYS.user]) : null,
    decodedToken: map[STORAGE_KEYS.decoded] ? JSON.parse(map[STORAGE_KEYS.decoded]) : null,
    customerProfile: null,
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialState);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const persisted = await readPersistedAuthState();
        if (persisted.accessToken) {
          let decoded: DecodedToken | null = null;
          try {
            decoded = persisted.decodedToken ?? decodeJwt(persisted.accessToken);
          } catch (err) {
            console.warn('[AuthContext] decode persisted token failed', err);
          }

          let customerProfile: CustomerProfile | null = null;
          if (decoded?.customerId && persisted.accessToken) {
            try {
              customerProfile = await getCustomerById({
                customerId: decoded.customerId,
                accessToken: persisted.accessToken,
              });
            } catch (err) {
              console.warn('[AuthContext] load profile failed', err);
            }
          }

          setAuthState({
            accessToken: persisted.accessToken,
            refreshToken: persisted.refreshToken,
            user: persisted.user,
            decodedToken: decoded,
            customerProfile,
          });
        }
      } catch (err) {
        console.warn('[AuthContext] hydrate error', err);
      } finally {
        setIsHydrating(false);
      }
    };
    hydrate();
  }, []);

  const login = async (payload: LoginRequest) => {
    const response = await loginCustomer(payload);
    const { accessToken, refreshToken, user } = response.data;
    const decoded = decodeJwt(accessToken);

    // Convert undefined to null for refreshToken
    const refreshTokenValue = refreshToken ?? null;

    let customerProfile: CustomerProfile | null = null;
    if (decoded?.customerId) {
      customerProfile = await getCustomerById({
        customerId: decoded.customerId,
        accessToken,
      });
    }

    setAuthState({
      accessToken,
      refreshToken: refreshTokenValue,
      user,
      decodedToken: decoded,
      customerProfile,
    });

    await persistAuthState({
      accessToken,
      refreshToken: refreshTokenValue,
      user,
      decodedToken: decoded,
      customerProfile,
    });

    console.log('[AuthContext] login success for user:', user.email);

    return response.data;
  };

  const logout = async () => {
    try {
      setAuthState(initialState);
      await clearPersistedAuthState();
      console.log('[AuthContext] logout success');
    } catch (error) {
      // Even if clearing storage fails, reset state
      setAuthState(initialState);
      console.warn('[AuthContext] logout error (state cleared anyway):', error);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      isAuthenticated: Boolean(authState.accessToken && authState.decodedToken) && !isHydrating,
      login,
      logout,
    }),
    [authState, isHydrating],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};

