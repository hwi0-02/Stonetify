import { StyleSheet } from 'react-native';
import { colors, spacing, radii, typography, elevation, hitSlop } from './ui';

export const card = ({ padding = spacing.md, withBorder = true, muted = false, interactive = false } = {}) => ({
  backgroundColor: muted ? colors.surfaceMuted : colors.surface,
  borderRadius: radii.md,
  padding,
  ...(withBorder
    ? {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }
    : {}),
  ...(interactive ? elevation.card : {}),
});

export const listItem = ({
  paddingHorizontal = spacing.md,
  paddingVertical = spacing.sm,
  withDivider = true,
  align = 'center',
} = {}) => ({
  flexDirection: 'row',
  alignItems: align,
  paddingHorizontal,
  paddingVertical,
  ...(withDivider
    ? {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
      }
    : {}),
});

export const buttonPrimary = ({
  align = 'center',
  pill = true,
} = {}) => ({
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: align,
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.lg,
  borderRadius: pill ? radii.pill : radii.lg,
  backgroundColor: colors.accent,
  ...elevation.overlay,
});

export const buttonSecondary = ({
  align = 'center',
  pill = true,
} = {}) => ({
  ...buttonPrimary({ align, pill }),
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderColor: colors.accent,
  shadowColor: 'transparent',
});

export const iconButton = ({
  size = 40,
  circular = true,
} = {}) => ({
  width: size,
  height: size,
  borderRadius: circular ? size / 2 : radii.md,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: colors.surface,
});

export const textVariants = {
  title: {
    ...typography.subheading,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  danger: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
};

export const modalOverlay = {
  flex: 1,
  backgroundColor: colors.overlay,
  justifyContent: 'center',
  alignItems: 'center',
};

export const section = ({ gap = spacing.sm, padding = spacing.md } = {}) => ({
  ...card({ padding, withBorder: false, muted: true }),
  gap,
});

export const pressableHitSlop = hitSlop.md;

export default {
  card,
  listItem,
  buttonPrimary,
  buttonSecondary,
  iconButton,
  textVariants,
  modalOverlay,
  section,
  pressableHitSlop,
};
