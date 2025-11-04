import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationState } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe, setToken, setUser, clearAuth } from '../store/slices/authSlice';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator, { TAB_BAR_HEIGHT } from './MainTabNavigator';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import PlayerScreen from '../screens/PlayerScreen';
import CreatePlaylistScreen from '../screens/CreatePlaylistScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import WriteFeedScreen from '../screens/WriteFeedScreen';
import SavedScreen from '../screens/SavedScreen';
import LikedPostsScreen from '../screens/LikedPostsScreen';
import MyFeedScreen from '../screens/MyFeedScreen';
import FollowingListScreen from '../screens/FollowingListScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChartScreen from '../screens/ChartScreen';
import SocialCallbackScreen from '../screens/SocialCallbackScreen';
import MiniPlayer from '../components/MiniPlayer';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createStackNavigator();

// MiniPlayer 표시 로직을 담당하는 내부 컴포넌트
const NavigatorWithMiniPlayer = ({ isAuthenticated }) => {
  const navigationState = useNavigationState(state => state);
  const { currentTrack, isPlayerScreenVisible } = useSelector(state => state.player);
  
  // 현재 활성화된 route 이름 확인
  const getCurrentRouteName = () => {
    if (!navigationState?.routes || typeof navigationState.index !== 'number') return null;
    
    const route = navigationState.routes[navigationState.index];
    if (!route) return null;
    
    if (route.state?.routes && typeof route.state.index === 'number') {
      // Tab Navigator 내부의 경우
      const tabRoute = route.state.routes[route.state.index];
      return tabRoute?.name || null;
    }
    return route.name;
  };
  
  const currentRoute = getCurrentRouteName();
  
  // MiniPlayer를 보여줄 조건: 메인 화면(Home, Profile)이고, PlayerScreen이 열려있지 않을 때
  const shouldShowMiniPlayer = Boolean(
    currentTrack && 
    !isPlayerScreenVisible && 
    (currentRoute === 'Home' || currentRoute === 'Profile' || currentRoute === 'Feed')
  );

  return (
    <>
      <View style={styles.navigatorContainer}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <>
              <Stack.Screen name="Auth" component={AuthNavigator} />
              <Stack.Screen name="KakaoCallback" component={SocialCallbackScreen} />
              <Stack.Screen name="NaverCallback" component={SocialCallbackScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabNavigator} />
              <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
              <Stack.Screen name="CreatePlaylist" component={CreatePlaylistScreen} />
              <Stack.Screen name="Chart" component={ChartScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="WriteFeed" component={WriteFeedScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Saved" component={SavedScreen} />
              <Stack.Screen name="UserProfile" component={UserProfileScreen} />
              <Stack.Screen name="LikedPosts" component={LikedPostsScreen} />
              <Stack.Screen name="FollowingList" component={FollowingListScreen} />
              <Stack.Screen name="MyFeedScreen" component={MyFeedScreen} />
              <Stack.Screen
                name="Player"
                component={PlayerScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          )}
        </Stack.Navigator>
      </View>
      {isAuthenticated && shouldShowMiniPlayer && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </>
  );
};

const AppNavigator = () => {
  const { token, user, status } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 저장된 토큰 및 사용자 정보 복원
    const bootstrapAsync = async () => {
      try {
        const bootToken = await AsyncStorage.getItem('token');

        const [storedUserStr, tokenExpiry] = await Promise.all([
          AsyncStorage.getItem('user'),
          AsyncStorage.getItem('tokenExpiry'),
        ]);

        const userToken = bootToken;
        
        // 토큰이 없으면 즉시 로그인 화면으로
        if (!userToken) {
          dispatch(clearAuth());
          setIsLoading(false);
          return;
        }
        
        // 토큰 만료 시간 검증
        if (tokenExpiry) {
          const expiryTime = parseInt(tokenExpiry, 10);
          if (Date.now() > expiryTime) {
            await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiry']);
            dispatch(clearAuth());
            setIsLoading(false);
            return;
          }
        }
        
        // 토큰을 Redux에 먼저 설정 (API 요청에 필요)
        dispatch(setToken(userToken));
        
        // 저장된 user 정보가 있으면 먼저 복원 (UI 즉시 렌더링용)
        let storedUser = null;
        if (storedUserStr) {
          try {
            storedUser = JSON.parse(storedUserStr);
            dispatch(setUser(storedUser));
          } catch (e) {
            console.error('❌ [AppNavigator] User 정보 파싱 실패:', e);
          }
        }
        
        // ✅ 최신 user 정보를 서버에서 가져오기 (토큰 유효성 검증 포함)
        // 단, 저장된 user가 있어야 getMe 호출 (토큰만 있고 user 없으면 로그아웃)
        if (storedUser && storedUser.id) {
          try {
            const freshUser = await dispatch(getMe()).unwrap();
          } catch (getMeError) {
            // getMe 실패 = 토큰 만료 또는 유효하지 않음
            const errorStatus = getMeError?.status ?? getMeError?.response?.status ?? null;
            console.error('❌ [AppNavigator] 토큰 검증 실패:', getMeError?.message || getMeError, 'status:', errorStatus);
            
            // 네트워크 오류가 아닌 경우에만 캐시 정리 (401, 403 등)
            if (errorStatus === 401 || errorStatus === 403) {
              await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiry']);
              dispatch(clearAuth());
            } else {
              // 네트워크 오류 등의 경우 저장된 user 정보로 계속 진행
            }
          }
        } else {
          // user 정보가 없으면 로그아웃
          await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiry']);
          dispatch(clearAuth());
        }
      } catch (error) {
        console.error('❌ [AppNavigator] 앱 초기화 중 오류:', error);
        // 예상치 못한 오류 발생 시에도 캐시 정리
        await AsyncStorage.multiRemove(['token', 'user', 'tokenExpiry']);
        dispatch(clearAuth());
      } finally {
        setIsLoading(false);
      }
    };
    bootstrapAsync();
  }, [dispatch]);

  // 앱 초기화 중이거나 인증 처리 중일 때는 로딩 화면 표시
  // status가 'loading'이면 인증 API 호출 중이므로 대기
  const isInitializing = isLoading || status === 'loading';
  
  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  // loading이 완료된 후에만 인증 상태 판단 및 화면 전환
  const isAuthenticated = Boolean(token && user?.id);

  // 딥링킹 설정 (웹 URL 처리용)
  const linking = {
    prefixes: ['stonetify://', 'https://carroll-foliicolous-conqueringly.ngrok-free.dev'],
    config: {
      screens: {
        Auth: {
          screens: {
            Login: 'login',
            SignUp: 'signup',
            Welcome: 'welcome',
            OAuthFinish: 'oauth-finish', // 서버 주도 OAuth 완료 화면
          },
        },
        KakaoCallback: 'kakao-callback',
        NaverCallback: 'naver-callback',
        Main: {
          screens: {
            Home: 'home',
            Search: 'search',
            Feed: 'feed',
            Profile: 'profile',
          },
        },
      },
    },
  };

  return (
    <View style={styles.container}>
      <NavigationContainer 
        linking={linking}
        key={isAuthenticated ? 'authenticated' : 'unauthenticated'}
      >
        <NavigatorWithMiniPlayer isAuthenticated={isAuthenticated} />
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    navigatorContainer: {
      flex: 1,
    },
    miniPlayerContainer: {
      position: 'absolute',
      bottom: TAB_BAR_HEIGHT, // 탭바 바로 위에 여백 없이 배치
      left: 0,
      right: 0,
      zIndex: 1000,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
});

export default AppNavigator;
