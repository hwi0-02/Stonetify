// Frontend/hooks/useSocialAuth.js
// 서버 주도 OAuth 플로우 Hook (웹/모바일 공통, returnUrl 화이트리스트 대응)

import { useCallback, useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Platform, Linking } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../utils/toast';
import { setUser, setToken } from '../store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// 세션 정리
WebBrowser.maybeCompleteAuthSession();

/* ──────────────────────────────────────────────────────────
 * 환경변수/설정 로더
 *  - EXPO_PUBLIC_API_URL            예: https://api.example.com/api  또는 http://localhost:5000/api
 *  - EXPO_PUBLIC_TUNNEL_API_URL     예: https://xxxx.ngrok-free.dev/api
 *  - EXPO_PUBLIC_ALLOWED_RETURN_ORIGINS  (쉼표 분리) 예:
 *      https://carroll-foliicolous-conqueringly.ngrok-free.dev,
 *      https://intermetameric-horrifiedly-latoria.ngrok-free.dev,
 *      stonetify://oauth-finish
 *  - EXPO_PUBLIC_OAUTH_FINISH_PATH  기본 '/oauth-finish'
 *  - EXPO_PUBLIC_OAUTH_FINISH_NATIVE (기본 'stonetify://oauth-finish')
 * ────────────────────────────────────────────────────────── */

function readExtra(key, fallback) {
  return (
    process.env[key] ??
    Constants.expoConfig?.extra?.[key] ??
    fallback
  );
}

function normalizeBaseApi(u) {
  // '.../api' 로 끝나면 떼고 base 반환
  return String(u || '').replace(/\/api\/?$/i, '');
}

function getApiUrl() {
  const base =
    normalizeBaseApi(
      readExtra('EXPO_PUBLIC_API_URL', null) ||
      readExtra('EXPO_PUBLIC_TUNNEL_API_URL', null) ||
      Constants.expoConfig?.extra?.apiUrl ||
      'http://localhost:5000/api'
    );
  // 이후 경로 조립 시 /api를 다시 붙인다
  return base;
}

const DEFAULT_ALLOWED = [
  'https://carroll-foliicolous-conqueringly.ngrok-free.dev',
  'https://intermetameric-horrifiedly-latoria.ngrok-free.dev',
  'stonetify://oauth-finish',
];

function getAllowedReturnOrigins() {
  const raw =
    readExtra('EXPO_PUBLIC_ALLOWED_RETURN_ORIGINS', null);
  if (!raw) return DEFAULT_ALLOWED;
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function getFinishPath() {
  return readExtra('EXPO_PUBLIC_OAUTH_FINISH_PATH', '/oauth-finish');
}

function getNativeFinishUrl() {
  return readExtra('EXPO_PUBLIC_OAUTH_FINISH_NATIVE', 'stonetify://oauth-finish');
}

/**
 * 화이트리스트에 맞는 returnUrl 선택
 * - 웹: window.location.origin이 화이트리스트에 있으면 origin + /oauth-finish
 *       없으면 화이트리스트 내 첫 번째 https origin + /oauth-finish
 * - 모바일: stonetify://oauth-finish (또는 ENV로 지정한 값)
 */
function pickReturnUrl() {
  const allowed = getAllowedReturnOrigins();
  const finishPath = getFinishPath();

  if (Platform.OS === 'web') {
    try {
      const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : null;

      // window.origin이 화이트리스트 중 하나와 정확히 일치하면 그걸 사용
      if (origin && allowed.some(a => a === origin)) {
        return `${origin}${finishPath.startsWith('/') ? finishPath : `/${finishPath}`}`;
      }

      // 아니라면 화이트리스트 중 https로 시작하는 첫 엔트리 사용
      const httpsOrigin = allowed.find(a => a.startsWith('https://'));
      if (httpsOrigin) {
        return `${httpsOrigin}${finishPath.startsWith('/') ? finishPath : `/${finishPath}`}`;
      }

      // 마지막 수단: 첫 엔트리를 그대로 사용 (만약 슬래시 경로가 아니라면 그대로)
      return allowed[0];
    } catch {
      // 예외 시 기본값 (화이트리스트의 첫 https 또는 디폴트 도메인)
      const httpsOrigin = allowed.find(a => a.startsWith('https://'));
      return `${httpsOrigin || DEFAULT_ALLOWED[0]}${finishPath}`;
    }
  }

  // 모바일: 네이티브 딥링크
  return getNativeFinishUrl();
}

/**
 * 1회용 코드 → 토큰 교환 (모바일 전용)
 */
async function exchangeCodeForToken(code, provider) {
  try {
    const base = getApiUrl();
    const resp = await fetch(`${base}/api/auth/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`Token exchange failed (${resp.status}) ${t}`);
    }
    const data = await resp.json();
    return data.token;
  } catch (err) {
    console.error(`❌ [${provider}] Code exchange error:`, err);
    showToast('로그인 처리 중 오류가 발생했습니다.');
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
 * 공통: 토큰 저장 + 내 정보 불러오기
 * ────────────────────────────────────────────────────────── */
async function persistAndFetchMe(token, dispatch) {
  if (!token) {
    throw new Error('Missing JWT while trying to persist session');
  }

  await AsyncStorage.setItem('token', token);
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // align with social slice persistence
  await AsyncStorage.setItem('tokenExpiry', String(expiry));

  dispatch(setToken(token));

  const base = getApiUrl();
  const me = await fetch(`${base}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!me.ok) throw new Error(`Failed to fetch user data (${me.status})`);
  const user = await me.json();
  dispatch(setUser(user));
}

/* ──────────────────────────────────────────────────────────
 * Kakao
 * ────────────────────────────────────────────────────────── */
export function useKakaoAuth() {
  const dispatch = useDispatch();
  const [isConnecting, setIsConnecting] = useState(false);
  const user = useSelector((s) => s.auth.user);

  // 모바일: 앱이 Deep Link로 열리는 경우 처리
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handler = async ({ url }) => {
      try {
        if (!url || !url.includes('oauth-finish')) return;
        const u = new URL(url);
        const code = u.searchParams.get('code');
        if (!code) return;
        const token = await exchangeCodeForToken(code, 'kakao');
        if (token) {
          setIsConnecting(true);
          await persistAndFetchMe(token, dispatch);
          showToast('카카오 로그인 성공');
        }
      } catch (e) {
        console.error('❌ [Kakao] deep link error:', e);
        showToast('로그인 후 사용자 정보를 가져올 수 없습니다.');
      } finally {
        setIsConnecting(false);
      }
    };

    const sub = Linking.addEventListener('url', handler);
    Linking.getInitialURL().then((url) => url && handler({ url }));
    return () => sub?.remove();
  }, [dispatch]);

  const connectKakao = useCallback(async () => {
    try {
      setIsConnecting(true);

      const base = getApiUrl();
      const returnUrl = pickReturnUrl();
      const startUrl = `${base}/api/auth/kakao/start?returnUrl=${encodeURIComponent(returnUrl)}`;

      if (Platform.OS === 'web') {
        // 웹: 현재 창에서 이동 (서버가 쿠키로 세션/토큰 처리 후 /oauth-finish로 되돌림)
        window.location.href = startUrl;
      } else {
        // 모바일: 외부 브라우저 세션
        const result = await WebBrowser.openAuthSessionAsync(
          startUrl,
          getNativeFinishUrl()
        );
        if (result.type === 'success' && result.url) {
          const u = new URL(result.url);
          const code = u.searchParams.get('code');
          if (code) {
            const token = await exchangeCodeForToken(code, 'kakao');
            if (token) {
              await persistAndFetchMe(token, dispatch);
              showToast('카카오 로그인 성공');
            }
          }
        } else if (result.type === 'cancel') {
          showToast('카카오 로그인이 취소되었습니다.');
        }
      }
    } catch (err) {
      console.error('❌ [Kakao] Connect error:', err);
      showToast('카카오 로그인 실패');
    } finally {
      if (Platform.OS !== 'web') setIsConnecting(false);
    }
  }, [dispatch]);

  return {
    connectKakao,
    isConnecting,
    isConnected: Boolean(user?.kakao_id),
  };
}

/* ──────────────────────────────────────────────────────────
 * Naver
 * ────────────────────────────────────────────────────────── */
export function useNaverAuth() {
  const dispatch = useDispatch();
  const [isConnecting, setIsConnecting] = useState(false);
  const user = useSelector((s) => s.auth.user);

  // 모바일: 앱이 Deep Link로 열리는 경우 처리
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handler = async ({ url }) => {
      try {
        if (!url || !url.includes('oauth-finish')) return;
        const u = new URL(url);
        const code = u.searchParams.get('code');
        if (!code) return;
        const token = await exchangeCodeForToken(code, 'naver');
        if (token) {
          setIsConnecting(true);
          await persistAndFetchMe(token, dispatch);
          showToast('네이버 로그인 성공');
        }
      } catch (e) {
        console.error('❌ [Naver] deep link error:', e);
        showToast('로그인 후 사용자 정보를 가져올 수 없습니다.');
      } finally {
        setIsConnecting(false);
      }
    };

    const sub = Linking.addEventListener('url', handler);
    Linking.getInitialURL().then((url) => url && handler({ url }));
    return () => sub?.remove();
  }, [dispatch]);

  const connectNaver = useCallback(async () => {
    try {
      setIsConnecting(true);

      const base = getApiUrl();
      const returnUrl = pickReturnUrl();
      const startUrl = `${base}/api/auth/naver/start?returnUrl=${encodeURIComponent(returnUrl)}`;

      if (Platform.OS === 'web') {
        window.location.href = startUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(
          startUrl,
          getNativeFinishUrl()
        );
        if (result.type === 'success' && result.url) {
          const u = new URL(result.url);
          const code = u.searchParams.get('code');
          if (code) {
            const token = await exchangeCodeForToken(code, 'naver');
            if (token) {
              await persistAndFetchMe(token, dispatch);
              showToast('네이버 로그인 성공');
            }
          }
        } else if (result.type === 'cancel') {
          showToast('네이버 로그인이 취소되었습니다.');
        }
      }
    } catch (err) {
      console.error('❌ [Naver] Connect error:', err);
      showToast('네이버 로그인 실패');
    } finally {
      if (Platform.OS !== 'web') setIsConnecting(false);
    }
  }, [dispatch]);

  return {
    connectNaver,
    isConnecting,
    isConnected: Boolean(user?.naver_id),
  };
}
