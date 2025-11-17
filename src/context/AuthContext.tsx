import React, { createContext, useContext, useMemo, useState } from 'react';
import { loginCustomer } from '../services/authService';
import { getCustomerById } from '../services/customerService';
import { DecodedToken, LoginRequest, LoginResponse } from '../types/auth';
import { CustomerProfile } from '../types/customer';
import { decodeJwt } from '../utils/jwt';

type AuthState = {
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

type AuthContextValue = {
  authState: AuthState;
  isAuthenticated: boolean;
  login: (payload: LoginRequest) => Promise<LoginResponse['data']>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialState);

  const login = async (payload: LoginRequest) => {
    const response = await loginCustomer(payload);
    const { accessToken, refreshToken, user } = response.data;
    const decoded = decodeJwt(accessToken);

    let customerProfile: CustomerProfile | null = null;
    if (decoded?.customerId) {
      customerProfile = await getCustomerById({
        customerId: decoded.customerId,
        accessToken,
      });
    }

    setAuthState({
      accessToken,
      refreshToken,
      user,
      decodedToken: decoded,
      customerProfile,
    });

    console.log('[AuthContext] login success for user:', user.email);

    return response.data;
  };

  const logout = async () => {
    setAuthState(initialState);
    console.log('[AuthContext] logout success');
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      isAuthenticated: Boolean(authState.accessToken && authState.decodedToken),
      login,
      logout,
    }),
    [authState],
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

