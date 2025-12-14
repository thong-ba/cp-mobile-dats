import httpClient from '../api/httpClient';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse } from '../types/auth';

const LOGIN_ENDPOINT = '/account/login/customer';
const REGISTER_ENDPOINT = '/account/register/customer';

export const loginCustomer = async (payload: LoginRequest): Promise<LoginResponse> => {
  const { data } = await httpClient.post<LoginResponse>(LOGIN_ENDPOINT, payload);
  return data;
};

export const registerCustomer = async (payload: RegisterRequest): Promise<RegisterResponse> => {
  const { data } = await httpClient.post<RegisterResponse>(REGISTER_ENDPOINT, payload);
  return data;
};

