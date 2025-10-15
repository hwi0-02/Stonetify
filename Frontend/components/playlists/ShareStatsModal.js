import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as palette, createStyles } from '../../utils/ui';
import {
  card as cardStyle,
  section as sectionStyle,
  textVariants,
  modalOverlay,
  pressableHitSlop,
} from '../../utils/uiComponents';
import * as apiService from '../../services/apiService';

const formatStatNumber = (value) => {
  if (typeof value !== 'number') {
    return '0';
  }
  return value.toLocaleString();
};

const styles = createStyles(({ spacing, colors, typography, radii }) => ({
  overlay: {
    ...modalOverlay,
    backgroundColor: colors.overlay,
  },
  container: {
    ...cardStyle({ padding: 0 }),
    width: '90%',
    maxWidth: 420,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surfaceMuted,
  },
  title: {
    ...typography.subheading,
    fontSize: 18,
  },
  closeButton: {
    ...cardStyle({ padding: spacing.xs, withBorder: false }),
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...textVariants.subtitle,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flexBasis: '48%',
    ...sectionStyle({ padding: spacing.md }),
    alignItems: 'center',
    gap: spacing.xs,
  },
  statNumber: {
    ...typography.subheading,
    fontSize: 22,
  },
  statLabel: {
    ...textVariants.subtitle,
    textAlign: 'center',
    fontSize: 12,
  },
  section: {
    ...sectionStyle({ padding: spacing.md }),
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.subheading,
    fontSize: 16,
  },
  dailyStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  dailyDate: {
    ...typography.body,
  },
  dailyNumbers: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dailyView: {
    ...textVariants.subtitle,
    color: colors.accent,
    fontSize: 12,
  },
  dailyShare: {
    ...textVariants.subtitle,
    color: colors.danger,
    fontSize: 12,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  methodName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  methodCount: {
    ...typography.body,
    color: colors.accent,
    fontWeight: '600',
  },
  popularTime: {
    ...typography.subheading,
    fontSize: 16,
  },
  popularTimeDesc: {
    ...textVariants.subtitle,
    fontSize: 12,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.subheading,
    textAlign: 'center',
  },
  emptySubtext: {
    ...textVariants.subtitle,
    textAlign: 'center',
    fontSize: 12,
  },
}));

const ShareStatsModal = ({ visible, onClose, playlistId }) => {
  const [shareStats, setShareStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const closeModal = useCallback(() => {
    setShareStats(null);
    onClose?.();
  }, [onClose]);

  const fetchShareStats = useCallback(async () => {
    if (!playlistId) {
      return;
    }

    setLoading(true);
    try {
      const stats = await apiService.getShareStats(playlistId);
      setShareStats(stats);
    } catch (error) {
      console.error('공유 통계 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    if (visible && playlistId) {
      fetchShareStats();
    }
  }, [visible, playlistId, fetchShareStats]);

  const dailyStats = useMemo(() => shareStats?.daily_stats ?? [], [shareStats?.daily_stats]);
  const shareMethods = useMemo(() => shareStats?.share_methods ?? {}, [shareStats?.share_methods]);
  const popularHours = shareStats?.popular_hours ?? null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>공유 통계</Text>
            <TouchableOpacity
              onPress={closeModal}
              style={styles.closeButton}
              hitSlop={pressableHitSlop}
              accessibilityLabel="공유 통계 닫기"
            >
              <Ionicons name="close" size={20} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={styles.loadingText}>통계를 불러오는 중...</Text>
            </View>
          ) : shareStats ? (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="eye-outline" size={28} color={palette.accent} />
                  <Text style={styles.statNumber}>{formatStatNumber(shareStats.total_views)}</Text>
                  <Text style={styles.statLabel}>총 조회수</Text>
                </View>

                <View style={styles.statCard}>
                  <Ionicons name="share-outline" size={28} color={palette.accent} />
                  <Text style={styles.statNumber}>{formatStatNumber(shareStats.total_shares)}</Text>
                  <Text style={styles.statLabel}>총 공유수</Text>
                </View>

                <View style={styles.statCard}>
                  <Ionicons name="heart-outline" size={28} color={palette.accent} />
                  <Text style={styles.statNumber}>{formatStatNumber(shareStats.total_likes)}</Text>
                  <Text style={styles.statLabel}>받은 좋아요</Text>
                </View>

                <View style={styles.statCard}>
                  <Ionicons name="calendar-outline" size={28} color={palette.accent} />
                  <Text style={styles.statNumber}>{formatStatNumber(shareStats.days_active)}</Text>
                  <Text style={styles.statLabel}>활성 일수</Text>
                </View>
              </View>

              {dailyStats.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>최근 7일 통계</Text>
                  {dailyStats.map((day) => (
                    <View key={day.date} style={styles.dailyStatRow}>
                      <Text style={styles.dailyDate}>{day.date}</Text>
                      <View style={styles.dailyNumbers}>
                        <Text style={styles.dailyView}>조회 {formatStatNumber(day.views)}</Text>
                        <Text style={styles.dailyShare}>공유 {formatStatNumber(day.shares)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {shareMethods && Object.keys(shareMethods).length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>공유 방법별 통계</Text>
                  {Object.entries(shareMethods).map(([method, count]) => (
                    <View key={method} style={styles.methodRow}>
                      <View style={styles.methodInfo}>
                        <Ionicons name={getMethodIcon(method)} size={20} color={palette.accent} />
                        <Text style={styles.methodName}>{getMethodName(method)}</Text>
                      </View>
                      <Text style={styles.methodCount}>{formatStatNumber(count)}회</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {popularHours ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>인기 시간대</Text>
                  <Text style={styles.popularTime}>
                    가장 많이 공유되는 시간: {formatStatNumber(popularHours.peak_hour)}시
                  </Text>
                  {popularHours.description ? (
                    <Text style={styles.popularTimeDesc}>{popularHours.description}</Text>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="analytics-outline" size={48} color={palette.textSecondary} />
              <Text style={styles.emptyText}>아직 공유 통계가 없습니다</Text>
              <Text style={styles.emptySubtext}>플레이리스트를 공유하여 통계를 확인해보세요</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// 공유 방법별 아이콘 반환
const getMethodIcon = (method) => {
  const icons = {
    link: 'link-outline',
    qr: 'qr-code-outline',
    social: 'share-social-outline',
    message: 'chatbubble-outline',
    email: 'mail-outline',
  };
  return icons[method] || 'share-outline';
};

// 공유 방법별 이름 반환
const getMethodName = (method) => {
  const names = {
    link: '링크 복사',
    qr: 'QR 코드',
    social: 'SNS 공유',
    message: '메시지',
    email: '이메일',
  };
  return names[method] || method;
};
ShareStatsModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  playlistId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

ShareStatsModal.defaultProps = {
  playlistId: null,
};

export default ShareStatsModal;
