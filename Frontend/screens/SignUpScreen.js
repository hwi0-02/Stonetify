import React, { useState, useEffect } from 'react';
import { View, Alert, Text, TouchableOpacity, ScrollView } from 'react-native';
import { register, resetAuthStatus } from '../store/slices/authSlice';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { colors as palette, createStyles } from '../utils/ui';
import { pressableHitSlop, textVariants } from '../utils/uiComponents';

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (status === 'failed' && error) {
      Alert.alert('회원가입 실패', error);
      dispatch(resetAuthStatus());
    }
  }, [status, error, dispatch]);

  const handleSignUp = () => {
    if (!email || !password || !displayName) {
      Alert.alert('입력 오류', '닉네임, 이메일, 비밀번호는 필수입니다.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    dispatch(register({ email, password, display_name: displayName }));
  };

  return (
    <LinearGradient colors={gradientColors} style={styles.background}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerArea}>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>Stonetify 커뮤니티에 합류해 플레이리스트를 공유하세요.</Text>
        </View>

        <View style={styles.formArea}>
          <AuthInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="닉네임"
            autoCapitalize="none"
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
        </View>

        <AuthButton
          title="가입하기"
          onPress={handleSignUp}
          loading={status === 'loading'}
        />

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.switchLink}
          hitSlop={pressableHitSlop}
        >
          <Text style={styles.switchText}>이미 계정이 있으신가요? 로그인</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const gradientColors = [palette.background, '#211E24'];

const styles = createStyles(({ colors, spacing, typography }) => ({
  background: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  headerArea: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.heading,
    fontSize: 34,
    letterSpacing: -0.8,
  },
  subtitle: {
    ...textVariants.subtitle,
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 320,
  },
  formArea: {
    width: '100%',
    gap: spacing.md,
  },
  switchLink: {
    paddingVertical: spacing.xs,
  },
  switchText: {
    ...textVariants.subtitle,
    color: palette.accent,
    fontWeight: '600',
  },
}));

export default SignUpScreen;
