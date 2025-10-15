import React from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createStyles } from '../../utils/ui';

const styles = createStyles(({ spacing, colors, typography, radii }) => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  title: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
  },
}));

const EmptyState = ({
  title = '콘텐츠가 없습니다',
  description,
  icon = 'musical-notes-outline',
  iconSize = 40,
}) => (
  <View style={styles.container}>
    <Ionicons name={icon} size={iconSize} color={styles.description.color} />
    <Text style={styles.title}>{title}</Text>
    {description ? <Text style={styles.description}>{description}</Text> : null}
  </View>
);

EmptyState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  icon: PropTypes.string,
  iconSize: PropTypes.number,
};

EmptyState.defaultProps = {
  title: '콘텐츠가 없습니다',
  description: undefined,
  icon: 'musical-notes-outline',
  iconSize: 40,
};

export default EmptyState;
