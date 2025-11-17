import axios from 'axios';

const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';
const RAW_TOKEN = process.env.EXPO_PUBLIC_API_TOKEN;

const AUTHORIZATION_HEADER =
  RAW_TOKEN && RAW_TOKEN.trim().length > 0
    ? RAW_TOKEN.startsWith('Bearer')
      ? RAW_TOKEN.trim()
      : `Bearer ${RAW_TOKEN.trim()}`
    : undefined;

const httpClient = axios.create({
  baseURL: DEFAULT_API_BASE_URL,
  timeout: 15000,
});

httpClient.interceptors.request.use((config) => {
  if (AUTHORIZATION_HEADER && !config.headers.Authorization) {
    config.headers.Authorization = AUTHORIZATION_HEADER;
  }
  config.headers.accept = config.headers.accept ?? 'application/json';
  return config;
});

export default httpClient;

