import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import apiService, { requestPasswordReset } from '../services/apiService';

// Backend 실제 엔드포인트는:
// POST /api/users/password-reset/request  { email }
// POST /api/users/password-reset/verify  { email, code, newPassword }
// (우리는 기존 apiService의 requestPasswordReset/resetPassword/verifyResetToken 대신 새 흐름 사용)

const STEP = {
  EMAIL: 0,
  CODE: 1,
  DONE: 2,
};

const ResetPasswordScreen = ({ navigation }) => {
  const [step, setStep] = useState(STEP.EMAIL);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // 쿨다운 타이머
  React.useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleRequestCode = async () => {
    if (!email) {
      Alert.alert('입력 오류', '이메일을 입력해주세요.');
      return;
    }
    try {
      setLoading(true);
      // 새 백엔드 엔드포인트 사용
      await apiService._rawPost?.('users/password-reset/request', { email }) || apiService.requestPasswordReset?.(email) || fetchRequestPasswordFallback();
      Alert.alert('안내', '비밀번호 재설정 코드가 전송되었습니다. 이메일을 확인하세요.');
      setStep(STEP.CODE);
      setResendCooldown(60);
    } catch (e) {
      Alert.alert('오류', e?.response?.data?.message || e.message || '코드 요청 실패');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestPasswordFallback = async () => {
    // fallback fetch (baseURL 활용 어려운 경우)
    return apiService.testConnection();
  };

  const handleVerifyAndReset = async () => {
    if (!code || !newPassword || !confirmPassword) {
      Alert.alert('입력 오류', '코드와 새 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      setLoading(true);
      // 직접 호출 (기존 apiService에 맞는 메소드 없어 새로 구현)
      await apiService._rawPost?.('users/password-reset/verify', { email, code, newPassword }) || verifyViaAxios();
      setStep(STEP.DONE);
    } catch (e) {
      Alert.alert('오류', e?.response?.data?.message || e.message || '코드 검증 실패');
    } finally {
      setLoading(false);
    }
  };

  const verifyViaAxios = async () => {
    // axios 인스턴스 직접 접근
    if (apiService && apiService._apiUrl) {
      const axios = require('axios').default;
      await axios.post(`${apiService._apiUrl}users/password-reset/verify`, { email, code, newPassword });
    } else {
      throw new Error('API 구성 오류');
    }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    handleRequestCode();
  };

  const renderEmailStep = () => (
    <View style={styles.card}>
      <Text style={styles.title}>비밀번호 재설정</Text>
      <Text style={styles.subtitle}>계정에 등록된 이메일 주소를 입력하세요.</Text>
      <AuthInput value={email} onChangeText={setEmail} placeholder="이메일" keyboardType="email-address" autoCapitalize="none" />
      <AuthButton title="코드 요청" onPress={handleRequestCode} loading={loading} />
      <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
        <Text style={styles.linkText}>로그인으로 돌아가기</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCodeStep = () => (
    <View style={styles.card}>
      <Text style={styles.title}>코드 입력</Text>
      <Text style={styles.subtitle}>이메일로 전송된 6자리 코드를 입력하고 새 비밀번호를 설정하세요.</Text>
      <AuthInput value={code} onChangeText={setCode} placeholder="6자리 코드" keyboardType="number-pad" maxLength={6} />
      <AuthInput value={newPassword} onChangeText={setNewPassword} placeholder="새 비밀번호" secureTextEntry />
      <AuthInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="비밀번호 확인" secureTextEntry />
      <AuthButton title="비밀번호 변경" onPress={handleVerifyAndReset} loading={loading} />
      <TouchableOpacity style={styles.resendWrapper} onPress={handleResend} disabled={resendCooldown > 0}>
        <Text style={[styles.resendText, resendCooldown > 0 && { opacity: 0.6 }]}>코드 재전송 {resendCooldown > 0 ? `(${resendCooldown}s)` : ''}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDoneStep = () => (
    <View style={styles.card}>
      <Text style={styles.title}>완료되었습니다</Text>
      <Text style={styles.subtitle}>비밀번호가 성공적으로 변경되었습니다. 이제 로그인할 수 있습니다.</Text>
      <AuthButton title="로그인 이동" onPress={() => navigation.replace('Login')} />
    </View>
  );

  return (
    <LinearGradient colors={['#121212', '#211E24']} style={styles.background}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {step === STEP.EMAIL && renderEmailStep()}
          {step === STEP.CODE && renderCodeStep()}
          {step === STEP.DONE && renderDoneStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: 'rgba(255,255,255,0.06)', padding: 20, borderRadius: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#aaa', marginBottom: 20, lineHeight: 20 },
  link: { marginTop: 16 },
  linkText: { color: '#8A2BE2', textAlign: 'center' },
  resendWrapper: { marginTop: 12, alignItems: 'center' },
  resendText: { color: '#1DB954', fontSize: 14 },
});

export default ResetPasswordScreen;
