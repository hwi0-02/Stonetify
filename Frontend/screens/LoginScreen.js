import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import apiService from '../services/apiService';
import { login, resetAuthStatus } from '../store/slices/authSlice';
import { useKakaoAuth, useNaverAuth } from '../hooks/useSocialAuth';

const kakaoLogo = require('../assets/images/kakao_logo.png');
const naverLogo = require('../assets/images/naver_logo.png');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('서버 연결 확인 중...');

  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  const { status, error, user } = auth;

  const { connectKakao, isConnecting: isKakaoConnecting } = useKakaoAuth(null);
  const { connectNaver, isConnecting: isNaverConnecting } = useNaverAuth(null);
  
  const kakaoState = useSelector((state) => state.social.kakao);
  const naverState = useSelector((state) => state.social.naver);

  // ✅ 로그인 성공 시 자동 이동
  useEffect(() => {
    if (user || (kakaoState.status === 'succeeded' && kakaoState.isConnected) || (naverState.status === 'succeeded' && naverState.isConnected)) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'HomeScreen' }],
      });
    }
  }, [user, kakaoState.status, kakaoState.isConnected, naverState.status, naverState.isConnected, navigation]);

  useEffect(() => {
    const isTunnelMode = () => {
      if (Platform.OS === 'web') {
        const currentUrl =
          typeof window !== 'undefined' && window.location
            ? window.location.href
            : '';
        return (
          currentUrl.includes('https://') &&
          (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'))
        );
      }
      const hostUri = Constants.expoConfig?.hostUri;
      return (
        hostUri &&
        (hostUri.includes('ngrok') ||
          hostUri.includes('tunnel') ||
          hostUri.includes('exp.direct'))
      );
    };

    if (isTunnelMode()) {
      setConnectionStatus(
        Platform.OS === 'web' ? '웹 터널 모드 (모바일 권장)' : '터널 모드'
      );
    } else {
      checkApiConnection();
    }
  }, []);

  const checkApiConnection = async () => {
    try {
      if (typeof apiService.healthCheck === 'function') {
        await apiService.healthCheck();
      }
      setConnectionStatus('서버 연결됨');
    } catch {
      setConnectionStatus('서버 연결 실패');
    }
  };

  useEffect(() => {
    if (status === 'failed') {
      Alert.alert('로그인 실패', error || '서버와의 연결을 확인해주세요.');
      dispatch(resetAuthStatus());
    }
  }, [status, error, dispatch]);

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    const currentUrl =
      typeof window !== 'undefined' && window.location
        ? window.location.href
        : '';
    const isTunnelMode =
      currentUrl.includes('https://') &&
      (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));

    if (!isTunnelMode && connectionStatus === '서버 연결 실패') {
      Alert.alert('연결 오류', '서버와 연결할 수 없습니다.', [
        { text: '다시 시도', onPress: checkApiConnection },
        { text: '취소', style: 'cancel' },
      ]);
      return;
    }

    dispatch(login({ email, password }));
  };

  const handleKakaoLogin = async () => {
    await connectKakao();
  };

  const handleNaverLogin = async () => {
    await connectNaver();
  };

  return (
    <LinearGradient colors={['#121212', '#211E24']} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#ffffff" />
        </TouchableOpacity>
        {/* 연결 상태 표시 */}
        <View style={styles.connectionStatus}>
          <Ionicons
            name={
              connectionStatus === '서버 연결됨'
                ? 'checkmark-circle'
                : connectionStatus === '서버 연결 확인 중...'
                ? 'time'
                : 'warning'
            }
            size={16}
            color={
              connectionStatus === '서버 연결됨'
                ? '#4CAF50'
                : connectionStatus === '서버 연결 확인 중...'
                ? '#FFC107'
                : '#F44336'
            }
          />
          <Text
            style={[
              styles.connectionText,
              {
                color:
                  connectionStatus === '서버 연결됨'
                    ? '#4CAF50'
                    : connectionStatus === '서버 연결 확인 중...'
                    ? '#FFC107'
                    : '#F44336',
              },
            ]}
          >
            {connectionStatus}
          </Text>
          {connectionStatus !== '서버 연결됨' &&
            connectionStatus !== '웹 터널 모드 (모바일 권장)' &&
            connectionStatus !== '터널 모드' && (
              <TouchableOpacity
                onPress={checkApiConnection}
                style={styles.retryButton}
              >
                <Ionicons name="refresh" size={16} color="#1DB954" />
              </TouchableOpacity>
            )}
        </View>

        {/* 터널 모드 안내 */}
        {connectionStatus === '웹 터널 모드 (모바일 권장)' && (
          <View style={styles.tunnelWarning}>
            <Ionicons name="information-circle" size={20} color="#FFC107" />
            <Text style={styles.tunnelWarningText}>
              웹 터널 모드에서 보안 제한으로 인해 로그인이 제한될 수 있습니다.{"\n"}
              모바일에서는 Expo Go 앱으로 QR 코드를 스캔해 접속하세요.
            </Text>
          </View>
        )}

        {/* 이메일 로그인 */}
        <Text style={styles.title}>로그인</Text>
        <AuthInput
          value={email}
          onChangeText={setEmail}
          placeholder="이메일"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AuthInput
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          secureTextEntry
        />
        <AuthButton
          title="이메일 로그인"
          onPress={handleLogin}
          loading={status === 'loading'}
          style={{ width: '100%', marginTop: 10 }}
        />

        <TouchableOpacity
          style={styles.forgotPasswordLink}
          onPress={() => navigation.navigate('ResetPassword')}>
          <Text style={styles.forgotPasswordText}>비밀번호를 잊으셨나요?</Text>
        </TouchableOpacity>

        {/* 소셜 로그인 구분선 */}
        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* 👇 [수정] 이 부분을 AuthButton 대신 원형 버튼으로 변경합니다 */}
        <View style={styles.socialLoginContainer}>
          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: '#FEE500' }]}
            onPress={() => handleSocialLogin('kakao')}
          >
            <Image source={kakaoLogo} style={styles.socialLogo} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.socialButton, { backgroundColor: '#03C75A' }]}
            onPress={() => handleSocialLogin('naver')}
          >
            <Image source={naverLogo} style={styles.socialLogo} />
          </TouchableOpacity>
        </View>

        {/* 하단 링크 */}

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.switchText}>
            계정이 없으신가요? {' '}
            <Text style={styles.switchTextHighlight}>회원가입</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  backButton: {
    position: 'absolute',
    top: 35,
    left: 15,
    zIndex: 1,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  connectionText: { marginLeft: 6, fontSize: 14, fontWeight: '500' },
  retryButton: { marginLeft: 8, padding: 4 },
  tunnelWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  tunnelWarningText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#FFC107',
    lineHeight: 18,
    flex: 1,
  },
  title: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginBottom: 30,
    letterSpacing: -0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#a7a7a7',
    fontSize: 14,
    fontWeight: '500',
  },
  switchText: {
    color: '#a7a7a7',
    marginTop: 20,
    fontSize: 15,
    textAlign: 'center',
  },
  switchTextHighlight: {
    color: '#9753a0ff',
    fontWeight: '600',
  },
  forgotPasswordLink: { 
    marginTop: 20, 
    marginBottom: 5 
  },
  forgotPasswordText: {
    color: '#1DB954',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  socialLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  socialLogo: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
});

export default LoginScreen;
