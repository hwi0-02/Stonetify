import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#8E44AD',       // 활성화된 탭 아이콘 색상 (보라색)
        tabBarInactiveTintColor: '#a7a7a7',  // 비활성화된 탭 아이콘 색상
        tabBarStyle: styles.tabBar,          // 탭 바 스타일
        headerShown: false,                  // 각 화면의 헤더는 각 스크린에서 커스텀
        tabBarShowLabel: false,              // 탭 바 라벨 숨기기
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#000',      // 탭 바 배경색 (검은색)
    borderTopWidth: 0,          // 상단 테두리 제거
    height: 80,                 // 탭 바 높이 조정
    paddingBottom: 20,          // 아이콘과 하단 간격
  },
});

export default MainTabNavigator;