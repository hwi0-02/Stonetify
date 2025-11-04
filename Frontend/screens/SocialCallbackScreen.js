import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { authenticateWithKakao, authenticateWithNaver } from '../store/slices/socialSlice';
import { showToast } from '../utils/toast';

/**
 * 소셜 로그인 콜백 처리 화면
 * 웹 환경에서 /kakao-callback, /naver-callback URL로 리다이렉트 시 처리
 */
export default function SocialCallbackScreen({ route }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const [isProcessing, setIsProcessing] = useState(true);
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (hasHandledRef.current) {
      return;
    }

    const processCallback = async () => {
      try {
        // URL에서 provider 확인 (route.name 우선 사용)
        let provider = null;
        if (route?.name === 'KakaoCallback') {
          provider = 'kakao';
        } else if (route?.name === 'NaverCallback') {
          provider = 'naver';
        } else {
          // route.name이 없으면 path나 window.location으로 판단
          const path = route?.path || (typeof window !== 'undefined' ? window.location.pathname : '');
          provider = path.includes('kakao') ? 'kakao' : path.includes('naver') ? 'naver' : null;
        }

        if (!provider) {
          console.error('❌ [SocialCallback] Provider 감지 실패');
          showToast('잘못된 접근입니다.');
          navigation.replace('Auth', { screen: 'Login' });
          return;
        }

        // URL 쿼리 파라미터에서 code와 state 추출
        let code, state, redirectUri;
        
        if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          code = urlParams.get('code');
          state = urlParams.get('state');
          redirectUri = window.location.origin + window.location.pathname;
        } else if (route?.params) {
          code = route.params.code;
          state = route.params.state;
          redirectUri = route.params.redirectUri;
        }

        if (hasHandledRef.current) {
          return;
        }

        hasHandledRef.current = true;

        // 인증 코드 검증
        if (!code) {
          showToast('인증 코드를 받지 못했습니다.');
          navigation.replace('Auth', { screen: 'Login' });
          return;
        }

        if (!state) {
          showToast('보안 오류: state 파라미터가 없습니다.');
          navigation.replace('Auth', { screen: 'Login' });
          return;
        }

        // Redux 액션으로 토큰 교환 및 로그인 처리
        const thunk = provider === 'kakao' ? authenticateWithKakao : authenticateWithNaver;
        
        const result = await dispatch(thunk({ code, state, redirectUri })).unwrap();
        showToast(`${provider === 'kakao' ? '카카오' : '네이버'} 로그인에 성공했습니다.`);

        // 메인 화면으로 이동
        navigation.replace('Main');
      } catch (error) {
        console.error('❌ [SocialCallback] 처리 실패:', error);
        const message = error?.message || error || '소셜 로그인에 실패했습니다.';
        showToast(message);
        navigation.replace('Auth', { screen: 'Login' });
      } finally {
        setIsProcessing(false);
        // 웹 환경에서 쿼리스트링을 제거해 새로고침 시 재요청되지 않도록 처리
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (historyErr) {
            console.warn('⚠️ [SocialCallback] history replace 실패:', historyErr);
          }
        }
      }
    };

    processCallback();
  }, [dispatch, navigation, route]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1DB954" />
      <Text style={styles.text}>로그인 처리 중...</Text>
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
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
