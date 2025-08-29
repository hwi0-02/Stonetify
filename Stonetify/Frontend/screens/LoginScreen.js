import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, resetAuthStatus } from '../store/slices/authSlice';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import { LinearGradient } from 'expo-linear-gradient';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);

  useEffect(() => {
    if (status === 'failed') {
      Alert.alert('로그인 실패', error);
      dispatch(resetAuthStatus());
    }
  }, [status, error, dispatch]);

  const handleLogin = () => {
    if (!email || !password) {
        Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
        return;
    }
    dispatch(login({ email, password }));
  };

  return (
    <LinearGradient colors={['#121212', '#211E24']} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
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
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 40,
    },
    switchText: {
        color: '#8A2BE2', // 보라색 텍스트
        marginTop: 10,
        fontSize: 16,
    }
});

export default LoginScreen;