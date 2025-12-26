import httpClient from '../api/httpClient';
import {
  CreateCustomerAddressPayload,
  CreateCustomerAddressResponse,
  CustomerAddress,
  CustomerProfile,
} from '../types/customer';

type AuthenticatedCustomerRequest = {
  customerId: string;
  accessToken: string;
};

export const getCustomerById = async ({
  customerId,
  accessToken,
}: AuthenticatedCustomerRequest): Promise<CustomerProfile> => {
  const { data } = await httpClient.get<CustomerProfile>(`/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
};

export const getCustomerAddresses = async ({
  customerId,
  accessToken,
}: AuthenticatedCustomerRequest): Promise<CustomerAddress[]> => {
  const { data } = await httpClient.get<CustomerAddress[]>(
    `/customers/${customerId}/addresses`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return data;
};

export const createCustomerAddress = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: CreateCustomerAddressPayload;
}): Promise<CustomerAddress> => {
  const { data } = await httpClient.post<CreateCustomerAddressResponse>(
    `/customers/${customerId}/addresses`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return data.data;
};

export const updateCustomerAddress = async ({
  customerId,
  addressId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  addressId: string;
  payload: CreateCustomerAddressPayload;
}): Promise<CustomerAddress> => {
  const { data } = await httpClient.put<CustomerAddress>(
    `/customers/${customerId}/addresses/${addressId}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return data;
};

export const deleteCustomerAddress = async ({
  customerId,
  addressId,
  accessToken,
}: AuthenticatedCustomerRequest & {
  addressId: string;
}): Promise<void> => {
  await httpClient.delete<void>(`/customers/${customerId}/addresses/${addressId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

export type UpdateCustomerProfilePayload = {
  fullName?: string;
  userName?: string;
  email?: string;
  phoneNumber?: string;
  gender?: 'MALE' | 'FEMALE' | null;
  dateOfBirth?: string | null; // ISO format: yyyy-MM-dd
  avatarURL?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | null;
  twoFactorEnabled?: boolean;
  kycStatus?: 'NONE' | 'PENDING' | 'VERIFIED' | null;
  preferredCategory?: string | null;
};

export const updateCustomerProfile = async ({
  customerId,
  accessToken,
  payload,
}: AuthenticatedCustomerRequest & {
  payload: UpdateCustomerProfilePayload;
}): Promise<CustomerProfile> => {
  const { data } = await httpClient.put<CustomerProfile>(
    `/customers/${customerId}`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  return data;
};


