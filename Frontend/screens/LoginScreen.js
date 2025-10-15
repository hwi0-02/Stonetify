import React, { useEffect, useMemo, useState } from 'react';
import { View, Alert, Text, TouchableOpacity, ScrollView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import { login, resetAuthStatus } from '../store/slices/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import apiService from '../services/apiService';
import { colors as palette, createStyles } from '../utils/ui';
import { textVariants, pressableHitSlop } from '../utils/uiComponents';

const STATUS = {
  CHECKING: '서버 연결 확인 중...',
  CONNECTED: '서버 연결됨',
  FAILURE: '서버 연결 실패',
  TUNNEL_WEB: '웹 터널 모드 (모바일 권장)',
  TUNNEL: '터널 모드',
};

const gradientColors = [palette.background, '#211E24'];

const getStatusMeta = (status) => {
  switch (status) {
    case STATUS.CONNECTED:
      return { icon: 'checkmark-circle', color: palette.accent };
    case STATUS.FAILURE:
      return { icon: 'warning', color: palette.danger };
    case STATUS.TUNNEL:
    case STATUS.TUNNEL_WEB:
      return { icon: 'information-circle', color: '#FFC107' };
    case STATUS.CHECKING:
    default:
      return { icon: 'time', color: '#FFC107' };
  }
};

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(STATUS.CHECKING);

  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const detectTunnelMode = () => {
      if (Platform.OS === 'web') {
        const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
        return currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));
      }
      const hostUri = Constants.expoConfig?.hostUri;
      return Boolean(hostUri && (hostUri.includes('ngrok') || hostUri.includes('tunnel') || hostUri.includes('exp.direct')));
    };

    if (detectTunnelMode()) {
      setConnectionStatus(Platform.OS === 'web' ? STATUS.TUNNEL_WEB : STATUS.TUNNEL);
    } else {
      checkApiConnection();
    }
  }, []);

  const checkApiConnection = async () => {
    try {
      await apiService.testConnection();
      setConnectionStatus(STATUS.CONNECTED);
    } catch (error) {
      setConnectionStatus(STATUS.FAILURE);
    }
  };

  useEffect(() => {
    if (status === 'failed') {
      Alert.alert('로그인 실패', error || '서버와의 연결을 확인해주세요.');
      dispatch(resetAuthStatus());
    }
  }, [status, error, dispatch]);

  const statusMeta = useMemo(() => getStatusMeta(connectionStatus), [connectionStatus]);
  const isTunnelWarning = connectionStatus === STATUS.TUNNEL_WEB;

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 모두 입력해주세요.');
        return;
    }
    const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
    const isTunnelMode = currentUrl.includes('https://') && (currentUrl.includes('exp.direct') || currentUrl.includes('ngrok'));

    if (!isTunnelMode && connectionStatus === STATUS.FAILURE) {
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
    <LinearGradient colors={gradientColors} style={styles.background}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={[styles.connectionStatus, { borderColor: statusMeta.color }]}>
          <Ionicons name={statusMeta.icon} size={16} color={statusMeta.color} />
          <Text style={[styles.connectionText, { color: statusMeta.color }]}>{connectionStatus}</Text>
          {![STATUS.CONNECTED, STATUS.TUNNEL_WEB, STATUS.TUNNEL].includes(connectionStatus) && (
            <TouchableOpacity
              onPress={checkApiConnection}
              style={styles.retryButton}
              hitSlop={pressableHitSlop}
            >
              <Ionicons name="refresh" size={16} color={palette.accent} />
            </TouchableOpacity>
          )}
        </View>

        {isTunnelWarning && (
          <View style={styles.tunnelWarning}>
            <Ionicons name="information-circle" size={20} color="#FFC107" />
            <Text style={styles.tunnelWarningText}>
              웹 터널 모드에서 보안 제한으로 인해 로그인이 제한될 수 있습니다.
              {'\n'}
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
        <AuthButton title="로그인" onPress={handleLogin} />
        <TouchableOpacity
          style={styles.forgotPasswordLink}
          onPress={() => navigation.navigate('ResetPassword')}
          hitSlop={pressableHitSlop}
        >
          <Text style={styles.forgotPasswordText}>비밀번호를 잊으셨나요?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} hitSlop={pressableHitSlop}>
          <Text style={styles.switchText}>계정이 없으신가요? 회원가입</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
  background: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  connectionText: {
    ...textVariants.subtitle,
    fontSize: 13,
  },
  retryButton: {
    marginLeft: spacing.xs,
    padding: spacing.xs,
  },
  tunnelWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 193, 7, 0.12)',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 193, 7, 0.4)',
  },
  tunnelWarningText: {
    ...textVariants.subtitle,
    color: '#FFC107',
    flex: 1,
    lineHeight: 18,
  },
  title: {
    ...typography.heading,
    fontSize: 30,
    alignSelf: 'flex-start',
    marginBottom: spacing.lg,
  },
  forgotPasswordLink: {
    marginTop: spacing.md,
  },
  forgotPasswordText: {
    ...textVariants.subtitle,
    color: palette.accent,
    textAlign: 'center',
  },
  switchText: {
    ...textVariants.subtitle,
    color: palette.accentSecondary,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
}));

export default LoginScreen;
