import httpClient from '../api/httpClient';
import { LoginRequest, LoginResponse } from '../types/auth';

const LOGIN_ENDPOINT = '/account/login/customer';

export const loginCustomer = async (payload: LoginRequest): Promise<LoginResponse> => {
  const { data } = await httpClient.post<LoginResponse>(LOGIN_ENDPOINT, payload);
  return data;
};

