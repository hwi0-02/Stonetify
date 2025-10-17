import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import AppNavigator from './navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { ActivityIndicator, View, StyleSheet, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { restorePlaybackState } from './store/slices/playerSlice';
import { useSelector, useDispatch } from 'react-redux';
import { refreshSpotifyToken, getPremiumStatus, fetchSpotifyProfile } from './store/slices/spotifySlice';
import { ensureSpotifyAdapter, suspendAdapterPolling, resumeAdapterPolling } from './adapters';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
// Use sentry-expo wrapper (managed workflow friendly)
let Sentry;
try {
  Sentry = require('sentry-expo');
} catch (e) {
  try { Sentry = require('@sentry/react-native'); } catch (_e) { Sentry = null; }
}
import { instrumentAdapterSwitch } from './utils/analytics';

// Initialize Sentry (guarded by env & once)
if (Sentry && !global.__SENTRY_INIT) {
  try {
    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
    if (dsn) {
      Sentry.init({
        dsn,
        enableNative: true,
        enableNativeCrashHandling: true,
        tracesSampleRate: 0.2,
        beforeSend(event) {
          if (event.request) delete event.request?.cookies;
          return event;
        }
      });
      global.__SENTRY_INIT = true;
    } else if (__DEV__) {
      console.log('Sentry DSN not provided; skipping init');
    }
  } catch (e) {
    console.warn('Sentry init failed', e.message);
  }
}

function CoreApp() {
  const dispatch = useDispatch();
  const { accessToken, tokenExpiry } = useSelector(state => state.spotify);
  const { user } = useSelector(state => state.auth);

  // Initialize Spotify adapter when user is available
  useEffect(() => {
    if (user?.id) {
      ensureSpotifyAdapter(user.id);
      instrumentAdapterSwitch('spotify_rest');
    }
  }, [user?.id]);

  // Token refresh scheduler
  useEffect(() => {
    if (!tokenExpiry) return;
    const now = Date.now();
    const delay = Math.max(tokenExpiry - now, 5000); // at least 5s
    const id = setTimeout(() => {
      dispatch(refreshSpotifyToken());
      dispatch(getPremiumStatus());
      dispatch(fetchSpotifyProfile());
    }, delay);
    return () => clearTimeout(id);
  }, [tokenExpiry, dispatch]);

  // Initial premium/profile fetch when token first appears
  useEffect(() => {
    if (accessToken) {
      dispatch(getPremiumStatus());
      dispatch(fetchSpotifyProfile());
    }
  }, [accessToken, dispatch]);

  // Suspend polling when app is backgrounded; resume on active
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        suspendAdapterPolling();
      } else if (state === 'active') {
        resumeAdapterPolling();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={styles.appContainer}>
      <AppNavigator />
    </View>
  );
}

export default function App() {
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // 앱 시작 시 필요한 폰트 로드
  async function loadAssetsAsync() {
    await Font.loadAsync({
      ...Ionicons.font,
    });
    setAssetsLoaded(true);
  }

  useEffect(() => {
    loadAssetsAsync();
  }, []);

  // Assets 로딩 완료 후 마지막 재생 상태 복원
  useEffect(() => {
    if (assetsLoaded) {
      // store 직접 사용 (Provider 외부 dispatch 필요 없음)
      store.dispatch(restorePlaybackState());
    }
  }, [assetsLoaded]);

  // 폰트 로딩 중일 때 로딩 화면 표시
  if (!assetsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <CoreApp />
        <StatusBar style="light" backgroundColor="#121212" />
      </Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  appContainer: {
    flex: 1,
  }
});