import React from 'react';
import { View, Text } from 'react-native';
import AuthButton from '../components/auth/AuthButton';
import { createStyles } from '../utils/ui';
import { textVariants } from '../utils/uiComponents';

const AuthScreen = ({ navigation }) => (
  <View style={styles.container}>
    <View style={styles.hero}>
      <Text style={styles.title}>Stonetify</Text>
      <Text style={styles.subtitle}>나만의 플레이리스트를 공유하고 발견하세요</Text>
    </View>

    <View style={styles.actions}>
      <AuthButton
        title="로그인"
        onPress={() => navigation.navigate('Login')}
      />
      <AuthButton
        title="회원가입"
        variant="secondary"
        onPress={() => navigation.navigate('SignUp')}
      />
    </View>
  </View>
);

const styles = createStyles(({ colors, spacing, typography }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl + spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.heading,
    fontSize: 44,
    color: colors.accent,
    letterSpacing: -1,
  },
  subtitle: {
    ...textVariants.subtitle,
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
}));

export default AuthScreen;