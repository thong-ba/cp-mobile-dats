import { decode as base64Decode } from 'base-64';
import { DecodedToken } from '../types/auth';

export const decodeJwt = (token: string): DecodedToken | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      throw new Error('Malformed token');
    }
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = base64Decode(normalizedPayload);
    return JSON.parse(decoded) as DecodedToken;
  } catch (error) {
    console.warn('decodeJwt failed', error);
    return null;
  }
};

