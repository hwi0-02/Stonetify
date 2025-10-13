import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AuthButton from '../components/auth/AuthButton';

const logoPurple = require('../assets/images/logo_purple.png');
const kakaoLogo = require('../assets/images/kakao_logo.png');
const naverLogo = require('../assets/images/naver_logo.png');

const WelcomeScreen = ({ navigation }) => {
  return (
    <LinearGradient
      colors={['#2A0D45', '#121212']}
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
          onPress={() => { /* 카카오 로그인 로직 */ }}
          style={{ marginBottom: 10, backgroundColor: '#FEE500' }}
          textStyle={{ color: '#000000' }}
          icon={kakaoLogo}
        />
        <AuthButton
          title="네이버로 시작하기"
          onPress={() => { /* 네이버 로그인 로직 */ }}
          style={{ marginBottom: 20, backgroundColor: '#03C75A' }}
          icon={naverLogo}
        />
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginText}>이미 계정이 있으신가요? 로그인</Text>
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
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 20,
    },
    subtitle: {
        fontSize: 18,
        color: '#a7a7a7',
        marginTop: 10,
    },
    footer: {
        width: '80%',
        paddingBottom: 50,
    },
    loginText: {
        color: '#a7a7a7',
        textAlign: 'center',
        marginTop: 15,
    }
});

export default WelcomeScreen;