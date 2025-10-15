import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseNumber(process.env.EXPO_PUBLIC_BACKEND_PORT || process.env.BACKEND_PORT, 5000);
const PROXY_PORT = parseNumber(process.env.EXPO_PUBLIC_PROXY_PORT || process.env.PROXY_PORT, 3001);
const TIMEOUT = parseNumber(process.env.EXPO_PUBLIC_API_TIMEOUT || process.env.API_TIMEOUT, 15000);
const RETRY_DELAY = parseNumber(
  process.env.EXPO_PUBLIC_API_RETRY_DELAY ||
  process.env.EXPO_PUBLIC_RETRY_DELAY ||
  process.env.RETRY_DELAY,
  1000,
);

const LOCAL_API_URL = process.env.EXPO_PUBLIC_LOCAL_API_URL ||
  process.env.DEV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  `http://${LOCAL_IP}:${BACKEND_PORT}/api/`;

const TUNNEL_API_URL = process.env.EXPO_PUBLIC_TUNNEL_API_URL ||
  process.env.TUNNEL_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  LOCAL_API_URL;

const PROXY_API_URL = process.env.EXPO_PUBLIC_PROXY_API_URL ||
  process.env.PROXY_API_URL ||
  `http://localhost:${PROXY_PORT}/proxy/api/`;

const PRODUCTION_API = process.env.EXPO_PUBLIC_PROD_API_URL ||
  process.env.PROD_API_URL ||
  LOCAL_API_URL;

export const API_CONFIG = {
  LOCAL_IP,
  BACKEND_PORT,
  PROXY_PORT,
  TIMEOUT,
  RETRY_DELAY,
  LOCAL_API_URL,
  TUNNEL_API_URL,
  PROXY_API_URL,
  PRODUCTION_API,
};

export const detectTunnelMode = () => {
  if (Platform.OS === 'web') {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
    return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
  }
  const hostUri = Constants.expoConfig?.hostUri;
  return Boolean(hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct')));
};

export const resolveBaseUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'web') {
      const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
      if (currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'))) {
        return API_CONFIG.PROXY_API_URL;
      }
      return `http://localhost:${API_CONFIG.BACKEND_PORT}/api/`;
    }

    if (detectTunnelMode()) {
      return API_CONFIG.TUNNEL_API_URL;
    }

    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${API_CONFIG.BACKEND_PORT}/api/`;
    }

    return API_CONFIG.LOCAL_API_URL;
  }

  return API_CONFIG.PRODUCTION_API;
};

export const API_BASE_URL = resolveBaseUrl();

const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

const logDebug = (__DEV__ ? console.log : () => {});
const logError = (__DEV__ ? console.error : () => {});

httpClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.url?.includes('playback/play')) {
    logDebug('📡 [HTTP] Playback request', {
      url: config.url,
      method: config.method,
      data: config.data,
    });
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest?.url?.includes('playback')) {
      logError('❌ [HTTP] Playback error', {
        url: originalRequest.url,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    if (error.response?.status === 401 && error.response?.data?.error === 'TOKEN_REVOKED') {
      await AsyncStorage.multiRemove(['spotifyToken', 'spotifyRefreshToken']);
      await AsyncStorage.setItem('spotifyNeedsReauth', 'true');

      const revokedError = new Error('Spotify 연결이 만료되었습니다. 다시 로그인해주세요.');
      revokedError.code = 'TOKEN_REVOKED';
      revokedError.requiresReauth = true;
      revokedError.originalError = error;
      return Promise.reject(revokedError);
    }

    if ((error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED') && !originalRequest?._retry) {
      originalRequest._retry = true;
      await new Promise((resolve) => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
      return httpClient(originalRequest);
    }

    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }

    return Promise.reject(error);
  },
);

export const handleApiError = (error, fallbackMessage = '처리 중 오류가 발생했습니다.') => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.message === 'Network Error') {
    return '네트워크에 연결할 수 없습니다.';
  }
  if (error?.code === 'TOKEN_REVOKED') {
    return error.message || 'Spotify 세션이 만료되었습니다.';
  }
  return fallbackMessage;
};

export const http = httpClient;

export default httpClient;
