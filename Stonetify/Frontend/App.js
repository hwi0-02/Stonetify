import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import AppNavigator from './navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font'; // 추가
import { ActivityIndicator, View, StyleSheet } from 'react-native'; // 추가
import { Ionicons } from '@expo/vector-icons'; // 추가

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  async function loadFonts() {
    await Font.loadAsync({
      // 필요한 폰트들을 여기에 추가
      // 예: 'YourCustomFont': require('./assets/fonts/YourCustomFont.ttf'),
      ...Ionicons.font, // Ionicons 아이콘 폰트 로드
    });
    setFontsLoaded(true);
  }

  useEffect(() => {
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <AppNavigator />
      <StatusBar style="light" /> {/* 상태바 글자색 변경 */}
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212', // 앱의 기본 배경색과 맞춤
  },
});