import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { login, resetAuthStatus } from '../store/slices/authSlice';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import { LinearGradient } from 'expo-linear-gradient';
import apiService from '../services/apiService';
import utils from '../utils'; // 공통 ?�틸리티 import
import Constants from 'expo-constants';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('서버 연결 확인 중...');

  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);

  useEffect(() => {
  // 터널 모드 감지 함수
    const isTunnelMode = () => {
      if (Platform.OS === 'web') {
        const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
  // HTTPS 터널 모드 감지
        return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
      }
      
      const hostUri = Constants.expoConfig?.hostUri;
      return hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct'));
    };

  // 터널 모드에서 Mixed Content 오류를 방지하기 위해 연결 테스트 스킵
    if (isTunnelMode()) {
      if (Platform.OS === 'web') {
  setConnectionStatus('웹 터널 모드 (모바일 권장)');
      } else {
  setConnectionStatus('터널 모드');
      }
    } else {
  // 로컬 모드에서 API 연결 상태 확인
      checkApiConnection();
    }
  }, []);

  const checkApiConnection = async () => {
    console.log('--- API 연결 테스트 시작 ---');
    // apiService에 설정된 baseURL을 가져와서 로그에 출력합니다.
    // _apiUrl은 apiService.js 파일에서 디버깅 목적으로 노출시켜 둔 내부 변수입니다.
    const apiUrl = apiService._apiUrl || 'API URL을 찾을 수 없음';
    console.log(`[연결 시도] 대상 주소: ${apiUrl}`);
    setConnectionStatus('서버 연결 확인 중...');

    try {
      await apiService.testConnection();
      setConnectionStatus('서버 연결됨');
      console.log('[연결 성공] 서버에 성공적으로 연결되었습니다.');
      console.log('--------------------------');
    } catch (error) {
      setConnectionStatus('서버 연결 실패');
      console.error('[연결 실패] 서버 연결에 실패했습니다. 아래 오류 정보를 확인하세요.');
      // 전체 에러 객체를 출력하여 Axios 에러의 상세 내용을 모두 확인할 수 있습니다.
      console.error('상세 오류 정보:', error);
      
      if (error.response) {
        // 서버가 응답했지만, 상태 코드가 2xx 범위가 아닌 경우
        console.error('서버 응답 데이터:', error.response.data);
        console.error('서버 응답 상태:', error.response.status);
      } else if (error.request) {
        // 요청은 이루어졌으나 응답을 받지 못한 경우 (네트워크 문제, CORS 등)
        console.error('서버로부터 응답을 받지 못했습니다. 네트워크 연결, 서버 실행 상태, 방화벽 및 CORS 설정을 확인하세요.');
      } else {
        // 요청을 설정하는 중에 에러가 발생한 경우
        console.error('Axios 요청 설정 중 오류가 발생했습니다:', error.message);
      }
      console.log('--------------------------');
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
    
  // 터널 모드에서는 연결 상태 확인 건너뛰고 바로 로그인 시도
    const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
    const isTunnelMode = currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
    
    if (!isTunnelMode && connectionStatus === '서버 연결 실패') {
      Alert.alert(
        '연결 오류', 
        '서버와 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
        [
          { text: '다시 시도', onPress: checkApiConnection },
          { text: '취소', style: 'cancel' }
        ]
      );
      return;
    }
    
    dispatch(login({ email, password }));
  };

  return (
    <LinearGradient colors={['#121212', '#211E24']} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
          {/* 연결 상태 표시 */}
          <View style={styles.connectionStatus}>
            <Ionicons 
              name={connectionStatus === '서버 연결됨' ? 'checkmark-circle' : 
                    connectionStatus === '서버 연결 확인 중...' ? 'time' : 'warning'} 
              size={16} 
              color={connectionStatus === '서버 연결됨' ? '#4CAF50' : 
                     connectionStatus === '서버 연결 확인 중...' ? '#FFC107' : '#F44336'} 
            />
            <Text style={[styles.connectionText, {
              color: connectionStatus === '서버 연결됨' ? '#4CAF50' : 
                     connectionStatus === '서버 연결 확인 중...' ? '#FFC107' : '#F44336'
            }]}>
              {connectionStatus}
            </Text>
            {connectionStatus !== '서버 연결됨' && connectionStatus !== '웹 터널 모드 (모바일 권장)' && connectionStatus !== '터널 모드' && (
              <TouchableOpacity onPress={checkApiConnection} style={styles.retryButton}>
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
          <AuthButton title="로그인" onPress={handleLogin} loading={status === 'loading'} />
          <TouchableOpacity style={styles.forgotPasswordLink} onPress={() => navigation.navigate('ResetPassword')}>
            <Text style={styles.forgotPasswordText}>비밀번호를 잊으셨나요?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.switchText}>계정이 없으신가요? 회원가입</Text>
          </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
    background: {
      flex: 1,
    },
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        padding: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    connectionText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '500',
    },
    retryButton: {
        marginLeft: 8,
        padding: 4,
    },
    tunnelWarning: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 20,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 193, 7, 0.3)',
        maxWidth: '100%',
    },
    tunnelWarningText: {
        marginLeft: 8,
        fontSize: 13,
        color: '#FFC107',
        lineHeight: 18,
        flex: 1,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 40,
    },
    switchText: {
        color: '#8A2BE2', // 보라???�스??
        marginTop: 10,
        fontSize: 16,
  },
  forgotPasswordLink: {
    marginTop: 15,
    marginBottom: 10,
  },
  forgotPasswordText: {
    color: '#1DB954',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default LoginScreen;
