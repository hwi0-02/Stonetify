// Frontend/screens/OAuthFinishScreen.js
// OAuth 완료 후 처리 화면 (웹 전용)

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { setUser, setToken } from '../store/slices/authSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function OAuthFinishScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [status, setStatus] = useState('처리 중...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // 사용자 정보 가져오기 (쿠키에서 자동으로 토큰 전달)
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 
          process.env.EXPO_PUBLIC_TUNNEL_API_URL || 
          'http://localhost:5000/api';
        
        const response = await fetch(`${apiUrl}/users/me`, {
          credentials: 'include', // 쿠키 포함
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        
        // Redux에 사용자 정보 저장
        dispatch(setUser(userData));
        
        // 로컬 저장소에도 저장 (오프라인 접근용)
        await AsyncStorage.setItem('user', JSON.stringify(userData));

        setStatus('로그인 성공!');
        
        // 메인 화면으로 이동
        setTimeout(() => {
          navigation.replace('MainTab');
        }, 1000);

      } catch (err) {
        console.error('❌ [OAuth Finish] Error:', err);
        setStatus('로그인 처리 중 오류가 발생했습니다.');
        setTimeout(() => navigation.replace('Auth'), 2000);
      }
    };

    if (typeof window !== 'undefined') {
      handleOAuthCallback();
    }
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1DB954" />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
