import { useCallback, useEffect, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useDispatch, useSelector } from 'react-redux';
import { showToast } from '../utils/toast';
import {
  clearSpotifySession,
  exchangeSpotifyCode,
  getPremiumStatus,
  fetchSpotifyProfile,
  revokeSpotify,
} from '../store/slices/spotifySlice';

// ✅ Web용 세션 정리
WebBrowser.maybeCompleteAuthSession();

const DEFAULT_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
  'streaming',
];

const resolveClientId = () =>
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
  || process.env.SPOTIFY_CLIENT_ID
  || Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
  || Constants.expoConfig?.extra?.spotifyClientId
  || null;

// ✅ Expo Go 환경 감지
const isExpoGo = () => Constants.appOwnership === 'expo';

/**
 * 🔧 buildRedirectUri 수정 요약:
 * - Expo Go일 때는 proxy redirect (https://auth.expo.dev/@user/app)
 * - Dev client / ngrok / standalone일 때는 명시적인 redirect URI 우선
 * - 반환되는 redirectUri가 backend와 Spotify Dashboard에 등록된 URI와 **항상 일치**해야 함
 */
const getProjectNameForProxy = () => {
  const explicitOwner = Constants?.expoConfig?.owner;
  const explicitSlug = Constants?.expoConfig?.slug;
  if (explicitOwner && explicitSlug) {
    return `@${explicitOwner}/${explicitSlug}`;
  }

  const manifest2 = Constants?.manifest2;
  const embedded = manifest2?.extra?.expoClient;
  if (embedded?.owner && embedded?.slug) {
    return `@${embedded.owner}/${embedded.slug}`;
  }

  const fallbackProject = embedded?.eas?.projectId || Constants?.expoConfig?.extra?.eas?.projectId;
  return fallbackProject || undefined;
};

const buildRedirectUri = () => {
  const scheme = Constants.expoConfig?.scheme || 'stonetify';
  const redirectPath = Constants.expoConfig?.extra?.spotifyRedirectPath || 'redirect';

  if (isExpoGo()) {
    const projectNameForProxy = getProjectNameForProxy();
    const proxyUri = AuthSession.makeRedirectUri({
      useProxy: true,
      projectNameForProxy,
    });
    return proxyUri;
  }

  // ✅ 명시적 override 우선 (standalone/dev client)
  const override =
    process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ||
    Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ||
    Constants.expoConfig?.extra?.spotifyRedirectUri;

  if (override) return override.trim();

  const backendRedirect = Constants.expoConfig?.extra?.backendRedirectUri;
  if (backendRedirect) return backendRedirect.trim();

  // ✅ 최종 fallback: 커스텀 스킴
  return `${scheme}://${redirectPath}`;
};

export function useSpotifyAuth(userId) {
  const dispatch = useDispatch();
  const spotifyState = useSelector((state) => state.spotify);

  const discovery = AuthSession.useAutoDiscovery('https://accounts.spotify.com');
  const clientId = useMemo(resolveClientId, []);
  const redirectUri = useMemo(buildRedirectUri, []);

  useEffect(() => {
    if (__DEV__) {
      console.log('[SpotifyAuth] Using redirect URI:', redirectUri);
      if (isExpoGo()) {
        console.log('[SpotifyAuth] Expo proxy target:', getProjectNameForProxy());
      }
    }
  }, [redirectUri]);

  const hasUser = !!userId;
  const responseHandledRef = useRef();
  const lastErrorRef = useRef(null);
  const successHandledRef = useRef(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? undefined,
      scopes: DEFAULT_SCOPES,
      usePKCE: true,
      redirectUri, // ✅ 반드시 backend와 동일해야 함
    },
    discovery
  );

  // 에러 토스트 처리
  useEffect(() => {
    if (spotifyState.authError && spotifyState.authError !== lastErrorRef.current) {
      lastErrorRef.current = spotifyState.authError;
      showToast(spotifyState.authError);
    }
  }, [spotifyState.authError]);

  // 인증 결과 처리
  useEffect(() => {
    if (!response || !hasUser) return;
    if (responseHandledRef.current === response) return;

    responseHandledRef.current = response;

    if (response.type === 'success') {
      successHandledRef.current = true;
      try { WebBrowser.dismissBrowser(); } catch (_) {}

      const code = response.params?.code;
      const codeVerifier = request?.codeVerifier;

      if (!code || !codeVerifier) {
        showToast('Spotify 인증 코드가 올바르게 수신되지 않았습니다. 다시 시도해주세요.');
        return;
      }

      // ✅ dispatch 시 redirect_uri를 프론트 기준이 아니라 backend에서 사용하는 값과 동일하게 보냄
      dispatch(exchangeSpotifyCode({
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri, // 반드시 Spotify Dashboard에 등록된 것과 일치해야 함
        userId,
        client_id: clientId,
      }))
        .unwrap()
        .then(async () => {
          await dispatch(getPremiumStatus());
          await dispatch(fetchSpotifyProfile());
          showToast('Spotify 계정이 연결되었습니다.');
        })
        .catch((err) => {
          const message = err?.message || err?.error_description || 'Spotify 토큰 교환 중 오류가 발생했습니다.';
          showToast(message);
        });
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      if (!successHandledRef.current) {
        showToast('Spotify 로그인이 취소되었습니다.');
      }
    } else if (response.type === 'error') {
      const message = response.error?.message || 'Spotify 인증 중 오류가 발생했습니다.';
      if (!successHandledRef.current) {
        showToast(message);
      }
    }
  }, [response, request, redirectUri, dispatch, userId, hasUser]);

  // 로그인 시도
  const connectSpotify = useCallback(async () => {
    successHandledRef.current = false;

    if (!clientId) return showToast('Spotify Client ID가 설정되지 않았습니다.');
    if (!hasUser) return showToast('로그인이 필요합니다.');
    if (!request) return showToast('Spotify 로그인 준비 중입니다. 잠시 후 다시 시도해주세요.');

    await dispatch(clearSpotifySession({ reason: 'proactive_reauth' }));
    await AsyncStorage.setItem('spotifyNeedsReauth', 'true');

    try {
      const result = await promptAsync({
        useProxy: isExpoGo(),
        showInRecents: true,
      });

      if (result?.type === 'dismiss' || result?.type === 'cancel') {
        if (!successHandledRef.current) showToast('Spotify 로그인이 취소되었습니다.');
      } else if (result?.type === 'error') {
        const rawError = result.error?.message || result.params?.error_description || result.params?.error;
        const message = rawError || 'Spotify 인증을 시작할 수 없습니다.';

        if (!successHandledRef.current) {
          if (message.toLowerCase().includes('redirect') || message.toLowerCase().includes('configuration')) {
            showToast(
              `Spotify Redirect URI가 일치하지 않습니다.\n대시보드에 아래 URI를 등록했는지 확인하세요:\n${redirectUri}`
            );
          } else {
            showToast(message);
          }
        }
      }
    } catch (err) {
      const message = err?.message || 'Spotify 인증 창을 여는 중 오류가 발생했습니다.';
      if (!successHandledRef.current) showToast(message);
    }
  }, [clientId, hasUser, request, dispatch, promptAsync]);

  // 연결 해제
  const disconnectSpotify = useCallback(async () => {
    if (!hasUser) return;
    try {
      await dispatch(revokeSpotify()).unwrap();
      showToast('Spotify 연결이 해제되었습니다.');
    } catch (err) {
      const message = err?.message || 'Spotify 연결 해제 중 오류가 발생했습니다.';
      showToast(message);
    }
  }, [dispatch, hasUser]);

  return {
    connectSpotify,
    disconnectSpotify,
    isReady: !!request,
    isConnecting: spotifyState.authStatus === 'loading',
    isConnected: Boolean(spotifyState.accessToken),
    isPremium: spotifyState.isPremium,
    profile: spotifyState.profile,
    authError: spotifyState.authError,
    redirectUri,
  };
}

export default useSpotifyAuth;
