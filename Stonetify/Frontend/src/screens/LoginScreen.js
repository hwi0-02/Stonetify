import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { login } from '../api/ApiService';
import { AuthContext } from '../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const { signIn } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('오류', '이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }
    try {
      const response = await login(email, password);
      const token = response.data.token;
      if (token) {
        signIn(token);
      } else {
        Alert.alert('로그인 실패', '토큰을 받지 못했습니다.');
      }
    } catch (error) {
      Alert.alert('로그인 실패', '이메일 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>이메일로 로그인</Text>
      <TextInput style={styles.input} placeholder="이메일 주소" placeholderTextColor="#B3B3B3" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="#B3B3B3" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}><Text style={styles.loginButtonText}>로그인</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('SignUp')}><Text style={styles.linkText}>이메일로 회원가입</Text></TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20, justifyContent: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 40, textAlign: 'center' },
  input: { backgroundColor: '#282828', color: '#FFFFFF', padding: 15, borderRadius: 5, marginBottom: 15, fontSize: 16 },
  loginButton: { backgroundColor: '#1DB954', padding: 15, borderRadius: 30, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  loginButtonText: { color: '#121212', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#B3B3B3', textAlign: 'center', marginBottom: 15 },
});

export default LoginScreen;