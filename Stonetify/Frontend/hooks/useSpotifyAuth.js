import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
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

// Ensure the auth session is properly finalized (web-only requirement)
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

const isExpoGo = () => Constants.appOwnership === 'expo';

const buildRedirectUri = () => {
  const override = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI
    || Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI
    || Constants.expoConfig?.extra?.spotifyRedirectUri;

  if (override) {
    return override;
  }

  return AuthSession.makeRedirectUri({
    scheme: 'stonetify',
    path: 'spotify-callback',
    useProxy: isExpoGo(),
  });
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
    }
  }, [redirectUri]);
  const hasUser = !!userId;
  const responseHandledRef = useRef();
  const lastErrorRef = useRef(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? undefined,
      scopes: DEFAULT_SCOPES,
      usePKCE: true,
      redirectUri,
    },
    discovery,
  );

  useEffect(() => {
    if (spotifyState.authError && spotifyState.authError !== lastErrorRef.current) {
      lastErrorRef.current = spotifyState.authError;
      showToast(spotifyState.authError);
    }
  }, [spotifyState.authError]);

  useEffect(() => {
    if (!response || !hasUser) return;
    if (responseHandledRef.current === response) return;
    responseHandledRef.current = response;

    if (response.type === 'success') {
      const code = response.params?.code;
      const codeVerifier = request?.codeVerifier;

      if (!code || !codeVerifier) {
        showToast('Spotify 인증 코드가 올바르게 수신되지 않았습니다. 다시 시도해주세요.');
        return;
      }

      dispatch(exchangeSpotifyCode({
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        userId,
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
      showToast('Spotify 로그인이 취소되었습니다.');
    } else if (response.type === 'error') {
      const message = response.error?.message || 'Spotify 인증 중 오류가 발생했습니다.';
      showToast(message);
    }
  }, [response, request, redirectUri, dispatch, userId, hasUser]);

  const connectSpotify = useCallback(async () => {
    if (!clientId) {
      showToast('Spotify Client ID가 설정되지 않았습니다.');
      return;
    }
    if (!hasUser) {
      showToast('로그인이 필요합니다.');
      return;
    }
    if (!request) {
      showToast('Spotify 로그인 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

  await dispatch(clearSpotifySession());
  await AsyncStorage.setItem('spotifyNeedsReauth', 'true');

    const useProxy = isExpoGo();
    try {
      const result = await promptAsync({
        useProxy,
        showInRecents: true,
      });

      if (result?.type === 'dismiss' || result?.type === 'cancel') {
        showToast('Spotify 로그인이 취소되었습니다.');
      } else if (result?.type === 'error') {
        const message = result.error?.message || 'Spotify 인증을 시작할 수 없습니다.';
        showToast(message);
      }
    } catch (err) {
      const message = err?.message || 'Spotify 인증 창을 여는 중 오류가 발생했습니다.';
      showToast(message);
    }
  }, [clientId, hasUser, request, dispatch, promptAsync]);

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
