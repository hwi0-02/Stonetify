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
import WriteFeedScreen from '../screens/WriteFeedScreen';
import UserProfileScreen from '../screens/UserProfileScreen'; 
import SavedScreen from '../screens/SavedScreen';
import { ActivityIndicator, View, StyleSheet } from 'react-native';


const RootStack = createStackNavigator();

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
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          // 토큰 없으면 Auth 스택으로
          <RootStack.Screen name="AuthStack" component={AuthNavigator} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabNavigator} />
            <RootStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
            <RootStack.Screen name="UserProfile" component={UserProfileScreen} />
            <RootStack.Screen name="CreatePlaylist" component={CreatePlaylistScreen} />
            <RootStack.Screen name="Player" component={PlayerScreen} options={{ presentation: 'modal' }} />
            <RootStack.Screen name="WriteFeed" component={WriteFeedScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="Saved" component={SavedScreen} />
          </>
        )}
      </RootStack.Navigator>
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