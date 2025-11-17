import httpClient from '../api/httpClient';
import { CustomerProfile } from '../types/customer';

export const getCustomerById = async ({
  customerId,
  accessToken,
}: {
  customerId: string;
  accessToken: string;
}): Promise<CustomerProfile> => {
  const { data } = await httpClient.get<CustomerProfile>(`/customers/${customerId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
};

