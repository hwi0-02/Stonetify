import React from 'react';
import PropTypes from 'prop-types';
import { TouchableOpacity, Text, Image } from 'react-native';
import { createStyles } from '../../utils/ui';
import {
  buttonPrimary,
  buttonSecondary,
  pressableHitSlop,
} from '../../utils/uiComponents';

const styles = createStyles(({ typography, spacing, colors }) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    gap: spacing.sm,
  },
  primary: {
    ...buttonPrimary(),
  },
  secondary: {
    ...buttonSecondary(),
  },
  text: {
    ...typography.subheading,
    fontSize: 16,
    letterSpacing: 0.5,
    color: colors.textPrimary,
  },
  textSecondary: {
    color: colors.accent,
  },
  icon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
}));

const AuthButton = ({ title, onPress, style, textStyle, icon, variant }) => {
  const isSecondary = variant === 'secondary';
  const buttonStyles = [
    styles.button,
    isSecondary ? styles.secondary : styles.primary,
    style,
  ];
  const labelStyles = [
    styles.text,
    isSecondary ? styles.textSecondary : null,
    textStyle,
  ];

  return (
    <TouchableOpacity style={buttonStyles} onPress={onPress} activeOpacity={0.85} hitSlop={pressableHitSlop}>
      {icon ? <Image source={icon} style={styles.icon} /> : null}
      <Text style={labelStyles}>{title}</Text>
    </TouchableOpacity>
  );
};

AuthButton.propTypes = {
  title: PropTypes.string.isRequired,
  onPress: PropTypes.func,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  textStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  icon: PropTypes.oneOfType([PropTypes.number, PropTypes.object]),
  variant: PropTypes.oneOf(['primary', 'secondary']),
};

AuthButton.defaultProps = {
  onPress: undefined,
  style: undefined,
  textStyle: undefined,
  icon: undefined,
  variant: 'primary',
};

export default AuthButton;