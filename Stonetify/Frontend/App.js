import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AuthContext } from './src/context/AuthContext';
import AuthScreen from './src/screens/AuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ProfileScreen from './src/screens/ProfileScreen';

SplashScreen.preventAutoHideAsync();

const AuthStackNav = createStackNavigator();
const MainTabNav = createBottomTabNavigator();

const AuthStack = () => (
  <AuthStackNav.Navigator screenOptions={{ headerShown: false }}>
    <AuthStackNav.Screen name="Auth" component={AuthScreen} />
    <AuthStackNav.Screen name="Login" component={LoginScreen} />
    <AuthStackNav.Screen name="SignUp" component={SignUpScreen} />
  </AuthStackNav.Navigator>
);

const MainAppTabs = () => (
  <MainTabNav.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;
        if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
        else if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
        else if (route.name === 'Profile') iconName = focused ? 'person-circle' : 'person-circle-outline';
        return <Ionicons name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#1DB954',
      tabBarInactiveTintColor: 'gray',
      tabBarStyle: { backgroundColor: '#181818', borderTopColor: '#282828' },
    })}
  >
    <MainTabNav.Screen name="Home" component={HomeScreen} />
    <MainTabNav.Screen name="Search" component={SearchScreen} />
    <MainTabNav.Screen name="Profile" component={ProfileScreen} />
  </MainTabNav.Navigator>
);

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);

  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  useEffect(() => {
    const prepareApp = async () => {
      let token = null;
      try {
        token = await AsyncStorage.getItem('userToken');
      } catch (e) { console.warn(e); }
      setUserToken(token);
      setIsLoading(false);
    };
    prepareApp();
  }, []);

  const authContext = useMemo(() => ({
    signIn: async (token) => {
      setIsLoading(true);
      await AsyncStorage.setItem('userToken', token);
      setUserToken(token);
      setIsLoading(false);
    },
    signOut: async () => {
      setIsLoading(true);
      await AsyncStorage.removeItem('userToken');
      setUserToken(null);
      setIsLoading(false);
    },
  }), []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !isLoading) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }} onLayout={onLayoutRootView}>
      <AuthContext.Provider value={authContext}>
        <NavigationContainer>
          {userToken == null ? <AuthStack /> : <MainAppTabs />}
        </NavigationContainer>
      </AuthContext.Provider>
    </View>
  );
};

export default App;