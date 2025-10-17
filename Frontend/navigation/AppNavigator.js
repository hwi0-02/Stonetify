import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationState } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe } from '../store/slices/authSlice';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator, { TAB_BAR_HEIGHT } from './MainTabNavigator';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import PlayerScreen from '../screens/PlayerScreen';
import CreatePlaylistScreen from '../screens/CreatePlaylistScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import WriteFeedScreen from '../screens/WriteFeedScreen';
import SavedScreen from '../screens/SavedScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import ChartScreen from '../screens/ChartScreen'
import MiniPlayer from '../components/MiniPlayer';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createStackNavigator();

// MiniPlayer 표시 로직을 담당하는 내부 컴포넌트
const NavigatorWithMiniPlayer = ({ token }) => {
  const navigationState = useNavigationState(state => state);
  const { currentTrack, isPlayerScreenVisible } = useSelector(state => state.player);
  
  // 현재 활성화된 route 이름 확인
  const getCurrentRouteName = () => {
    if (!navigationState) return null;
    
    const route = navigationState.routes[navigationState.index];
    if (route.state) {
      // Tab Navigator 내부의 경우
      const tabRoute = route.state.routes[route.state.index];
      return tabRoute.name;
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
          {!token ? (
            <Stack.Screen name="Auth" component={AuthNavigator} />
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
              <Stack.Screen
                name="Player"
                component={PlayerScreen}
                options={{ presentation: 'modal' }}
              />
            </>
          )}
        </Stack.Navigator>
      </View>
      {token && shouldShowMiniPlayer && (
        <View style={styles.miniPlayerContainer}>
          <MiniPlayer />
        </View>
      )}
    </>
  );
};

const AppNavigator = () => {
  const { token } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 앱 시작 시 저장된 토큰 확인 및 사용자 정보 로드
    const bootstrapAsync = async () => {
      const userToken = await AsyncStorage.getItem('token');
      if (userToken) {
        dispatch({ type: 'auth/login/fulfilled', payload: { token: userToken } });
        dispatch(getMe());
      }
      setIsLoading(false);
    };
    bootstrapAsync();
  }, [dispatch]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationContainer key={token ? 'authenticated' : 'unauthenticated'}>
        <NavigatorWithMiniPlayer token={token} />
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