import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createStyles } from '../../utils/ui';

const styles = createStyles(({ spacing, typography, colors }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.heading,
    fontSize: 22,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
}));

const SectionHeader = ({ title, actionLabel, onPressAction, icon = 'chevron-forward', renderAction }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {renderAction ? (
      renderAction()
    ) : (
      actionLabel && onPressAction ? (
        <TouchableOpacity style={styles.action} onPress={onPressAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name={icon} size={16} color={styles.actionText.color} />
        </TouchableOpacity>
      ) : null
    )}
  </View>
);

SectionHeader.propTypes = {
  title: PropTypes.string.isRequired,
  actionLabel: PropTypes.string,
  onPressAction: PropTypes.func,
  icon: PropTypes.string,
  renderAction: PropTypes.func,
};

SectionHeader.defaultProps = {
  actionLabel: undefined,
  onPressAction: undefined,
  icon: 'chevron-forward',
  renderAction: undefined,
};

export default SectionHeader;
