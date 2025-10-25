import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { register, resetAuthStatus } from '../store/slices/authSlice';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import { LinearGradient } from 'expo-linear-gradient';

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);

  useEffect(() => {
    if (status === 'failed' && error) {
      let title = '회원가입 실패';
      let message = error; // 기본 에러 메시지 (ex: "이미 존재하는 사용자입니다.")

      // 사용자님이 확인한 실제 에러 메시지로 확인합니다.
      if (error.includes('이미 존재하는 사용자입니다.')) {
        title = '이메일 중복';
        message = '이미 사용 중인 이메일입니다. 다른 이메일을 입력해주세요.';
      }
      else if (error.includes('이미 사용 중인 닉네임입니다.')) {
        title = '닉네임 중복';
        message = '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.';
      }
       Alert.alert(title, message); // 맞춤형 메시지를 띄웁니다.
      dispatch(resetAuthStatus());
    }
  }, [status, error, dispatch]);

  const handleSignUp = () => {
    if (!email || !password || !displayName) {
      Alert.alert('입력 오류', '닉네임, 이메일, 비밀번호는 필수입니다.');
      return;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      Alert.alert('입력 오류', '올바른 이메일 형식이 아닙니다.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    dispatch(register({ email, password, display_name: displayName }));
  };

  return (
    <LinearGradient colors={['#121212', '#211E24']} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>회원가입</Text>
        <AuthInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="닉네임"
        />
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
        <AuthInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="비밀번호 확인"
          secureTextEntry
        />
        <AuthButton title="가입하기" onPress={handleSignUp} loading={status === 'loading'} />
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.switchText}>이미 계정이 있으신가요? 로그인</Text>
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

export default SignUpScreen;