import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { signUp } from '../api/ApiService';

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSignUp = async () => {
    if (!email || !password || !displayName) {
      Alert.alert('오류', '모든 항목을 입력해주세요.');
      return;
    }
    try {
      await signUp(email, password, displayName);
      Alert.alert('성공', '회원가입이 완료되었습니다. 로그인 해주세요.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('회원가입 실패', error.response?.data?.message || '오류가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>이메일로 회원가입</Text>
      <TextInput style={styles.input} placeholder="이메일 주소" placeholderTextColor="#B3B3B3" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="#B3B3B3" value={password} onChangeText={setPassword} secureTextEntry />
      <TextInput style={styles.input} placeholder="닉네임" placeholderTextColor="#B3B3B3" value={displayName} onChangeText={setDisplayName} />
      <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}><Text style={styles.signUpButtonText}>회원가입</Text></TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20, justifyContent: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 40, textAlign: 'center' },
  input: { backgroundColor: '#282828', color: '#FFFFFF', padding: 15, borderRadius: 5, marginBottom: 15, fontSize: 16 },
  signUpButton: { backgroundColor: '#1DB954', padding: 15, borderRadius: 30, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  signUpButtonText: { color: '#121212', fontSize: 18, fontWeight: 'bold' },
});

export default SignUpScreen;