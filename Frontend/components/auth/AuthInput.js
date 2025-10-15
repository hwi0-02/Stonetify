import React from 'react';
import PropTypes from 'prop-types';
import { TextInput, View } from 'react-native';
import { colors as palette, createStyles } from '../../utils/ui';

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
  container: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  input: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    ...typography.body,
    fontSize: 16,
  },
}));

const AuthInput = ({ placeholder, value, onChangeText, secureTextEntry, style, keyboardType, autoCapitalize }) => (
  <View style={[styles.container, style]}>
    <TextInput
      style={styles.input}
      placeholder={placeholder}
  placeholderTextColor={palette.textMuted}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
  selectionColor={palette.textPrimary}
    />
  </View>
);

AuthInput.propTypes = {
  placeholder: PropTypes.string,
  value: PropTypes.string,
  onChangeText: PropTypes.func.isRequired,
  secureTextEntry: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  keyboardType: PropTypes.string,
  autoCapitalize: PropTypes.oneOf(['none', 'sentences', 'words', 'characters']),
};

AuthInput.defaultProps = {
  placeholder: undefined,
  value: '',
  secureTextEntry: false,
  style: undefined,
  keyboardType: 'default',
  autoCapitalize: 'none',
};

export default AuthInput;