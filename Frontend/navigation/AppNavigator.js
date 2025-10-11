import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe } from '../store/slices/authSlice';

import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import PlaylistDetailScreen from '../screens/PlaylistDetailScreen';
import PlayerScreen from '../screens/PlayerScreen';
import CreatePlaylistScreen from '../screens/CreatePlaylistScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createStackNavigator();

const AppNavigator = () => {
  // 👇 [수정됨] token 대신 user 객체를 로그인 상태의 기준으로 삼습니다.
  const { user } = useSelector((state) => state.auth); 
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const userToken = await AsyncStorage.getItem('token');
        if (userToken) {
          // 토큰이 있으면, 서버에 내 정보를 요청합니다.
          // unwrap()을 사용하면 thunk 액션이 끝날 때까지 기다립니다.
          await dispatch(getMe()).unwrap(); 
        }
      } catch (e) {
        // getMe가 실패하면 (예: 토큰 만료) 로그인 화면으로 갈 것이므로
        // 여기서는 에러를 무시해도 괜찮습니다.
        console.error('자동 로그인 실패:', e);
      } finally {
        // 성공하든 실패하든 로딩 상태를 종료합니다.
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, [dispatch]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* 👇 [수정됨] !token 대신 !user를 사용하여 화면을 결정합니다. */}
        {!user ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
            <Stack.Screen name="CreatePlaylist" component={CreatePlaylistScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen
              name="Player"
              component={PlayerScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
});

export default AppNavigator;