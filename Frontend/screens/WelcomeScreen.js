import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import AuthButton from '../components/auth/AuthButton';
import { useKakaoAuth, useNaverAuth } from '../hooks/useSocialAuth';

const logoPurple = require('../assets/images/logo_purple.png');
const kakaoLogo = require('../assets/images/kakao_logo.png');
const naverLogo = require('../assets/images/naver_logo.png');

const WelcomeScreen = ({ navigation }) => {
  const kakaoState = useSelector((state) => state.social.kakao);
  const naverState = useSelector((state) => state.social.naver);
  
  // 네비게이션 중복 실행 방지 플래그
  const kakaoNavigatedRef = React.useRef(false);
  const naverNavigatedRef = React.useRef(false);

  const { connectKakao, isConnecting: isKakaoConnecting } = useKakaoAuth(null);
  const { connectNaver, isConnecting: isNaverConnecting } = useNaverAuth(null);

  // 소셜 로그인 성공 시 홈 화면으로 이동 (중복 방지)
  useEffect(() => {
    if (kakaoState.status === 'succeeded' && kakaoState.isConnected && !kakaoNavigatedRef.current) {
      kakaoNavigatedRef.current = true;
      navigation.replace('Main');
    }
  }, [kakaoState.status, kakaoState.isConnected, navigation]);

  useEffect(() => {
    if (naverState.status === 'succeeded' && naverState.isConnected && !naverNavigatedRef.current) {
      naverNavigatedRef.current = true;
      navigation.replace('Main');
    }
  }, [naverState.status, naverState.isConnected, navigation]);

  const handleKakaoLogin = async () => {
    await connectKakao();
  };

  const handleNaverLogin = async () => {
    await connectNaver();
  };

  return (
    <LinearGradient
      colors={['#121212', '#4a236eff']}
      style={styles.container}
    >
      <View style={styles.content}>
        <Image source={logoPurple} style={styles.logo} />
        <Text style={styles.title}>Stonetify</Text>
        <Text style={styles.subtitle}>음악으로 하나되는 우리</Text>
      </View>
      <View style={styles.footer}>
        <AuthButton
          title="이메일로 시작하기"
          onPress={() => navigation.navigate('SignUp')}
          style={{ marginBottom: 10 }}
        />
        <AuthButton
          title="카카오로 시작하기"
          onPress={handleKakaoLogin}
          loading={isKakaoConnecting}
          style={{ marginBottom: 10, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderWidth: 1, borderColor: '#FEE500'  }}
          textStyle={{ color: '#FFFFFF' }}
          icon={kakaoLogo}
        />
        <AuthButton
          title="네이버로 시작하기"
          onPress={handleNaverLogin}
          loading={isNaverConnecting}
          style={{ marginBottom: 20, backgroundColor: 'rgba(0, 0, 0, 0.5)', borderWidth: 1, borderColor:'#03C75A' }}
          icon={naverLogo}
        />
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginText}>이미 계정이 있으신가요?{' '}
          <Text style={{ fontWeight: 'bold', color:'#cfc6c6ff' }}>로그인</Text></Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logo: {
        width: 120,
        height: 120,
        contentFit: 'contain',
    },
    maintitle: {
        fontSize: 70,
        color: '#fff',
        marginTop: 20,
        marginBottom: 5,
        fontFamily: 'AvenuedeMadison',
    },
    subtitle: {
        fontSize: 18,
        color: '#a7a7a7',
        marginTop: 10,
        fontFamily: 'GowunDodum-Regular',
    },
    footer: {
        width: '80%',
        paddingBottom: 50,
    },
    loginText: {
        color: '#c272ccff',
        textAlign: 'center',
        marginTop: 15,
    }
});

export default WelcomeScreen;
