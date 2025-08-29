import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import AppNavigator from './navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function App() {
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  async function loadAssetsAsync() {
    await Font.loadAsync({
      ...Ionicons.font,
    });
    setAssetsLoaded(true);
  }

  useEffect(() => {
    loadAssetsAsync();
  }, []);

  if (!assetsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <AppNavigator />
      <StatusBar style="light" backgroundColor="#121212" />
    </Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
});