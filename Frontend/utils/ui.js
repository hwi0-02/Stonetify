import { StyleSheet, Platform } from 'react-native';

export const colors = {
  background: '#121212',
  surface: '#1a1a1a',
  surfaceMuted: '#1E1E1E',
  overlay: 'rgba(0, 0, 0, 0.7)',
  accent: '#1DB954',
  accentSecondary: '#8E44AD',
  textPrimary: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#6a6a6a',
  border: 'rgba(255, 255, 255, 0.08)',
  divider: '#222222',
  danger: '#ff4444',
  muted: '#282828',
  shadow: '#000000',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
};

export const elevation = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: Platform.select({ ios: 12, android: 8, default: 0 }),
  },
  overlay: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: Platform.select({ ios: 10, android: 6, default: 0 }),
  },
};

export const hitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
};

export const createStyles = (builder) =>
  StyleSheet.create(
    builder({ colors, spacing, radii, typography, elevation, hitSlop }),
  );

export const ui = {
  colors,
  spacing,
  radii,
  typography,
  elevation,
  hitSlop,
  createStyles,
};

export default ui;
