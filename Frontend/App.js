import React, { useEffect, useState, useRef } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import AppNavigator from './navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { ActivityIndicator, View, StyleSheet, AppState, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { restorePlaybackState } from './store/slices/playerSlice';
import { useSelector, useDispatch } from 'react-redux';
import { refreshSpotifyToken, getPremiumStatus, fetchSpotifyProfile, hydrateSpotifySession } from './store/slices/spotifySlice';
import { ensureSpotifyAdapter, suspendAdapterPolling, resumeAdapterPolling } from './adapters';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { instrumentAdapterSwitch } from './utils/analytics';

function CoreApp() {
  const dispatch = useDispatch();
  const { accessToken, tokenExpiry } = useSelector(state => state.spotify);
  const { user } = useSelector(state => state.auth);
  const lastRestoredUserRef = useRef();

  useEffect(() => {
    dispatch(hydrateSpotifySession());
  }, [dispatch]);

  // Initialize Spotify adapter when user is available
  useEffect(() => {
    if (user?.id) {
      ensureSpotifyAdapter(user.id);
      instrumentAdapterSwitch('spotify_rest');
    }
  }, [user?.id]);

  // Handle deep links for OAuth (웹은 OAuthFinishScreen에서 처리)
  useEffect(() => {
    if (Platform.OS === 'web') return; // 웹은 라우터에서 처리
    
    const handleUrl = () => {};

    const subscription = Linking.addEventListener('url', handleUrl);
    
    // 앱이 닫혀있다가 deep link로 열렸을 때
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl({ url });
      }
    });

    return () => subscription?.remove();
  }, []);

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

  useEffect(() => {
    const resolvedUserId = user?.id || user?.userId || null;
    if (lastRestoredUserRef.current === resolvedUserId) {
      return;
    }
    lastRestoredUserRef.current = resolvedUserId;
    dispatch(restorePlaybackState({ userId: resolvedUserId }));
  }, [dispatch, user?.id, user?.userId]);

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
    try { 
      await Font.loadAsync({
        ...Ionicons.font,
        'SpaceMono-Regular': require('./assets/fonts/SpaceMono-Regular.ttf'), 
        'AvenuedeMadison': require('./assets/fonts/AvenuedeMadison.ttf'), 
        'IM_Hyemin-Bold': require('./assets/fonts/IM_Hyemin-Bold.ttf'),
        'SSVeryBadHandwritingRegular': require('./assets/fonts/SSVeryBadHandwritingRegular.ttf'),
        'lottemartLight': require('./assets/fonts/lottemartLight.ttf'),
        'GowunDodum-Regular': require('./assets/fonts/GowunDodum-Regular.ttf'),
      });
    } catch (e) {
        console.warn("폰트 로딩 중 오류 발생:", e); 
    } finally {
        setAssetsLoaded(true); 
    }
  }

  useEffect(() => {
    loadAssetsAsync();
  }, []);

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
