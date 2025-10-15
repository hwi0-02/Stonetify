import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors as palette, createStyles } from '../../utils/ui';
import {
  card as cardStyle,
  section as sectionStyle,
  textVariants,
  pressableHitSlop,
} from '../../utils/uiComponents';
import { useAppDispatch } from '../../store/hooks';
import { createShareLinkAsync } from '../../store/slices/playlistSlice';
import ShareStatsModal from './ShareStatsModal';

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '80%',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    ...typography.subheading,
    fontSize: 20,
  },
  closeButton: {
    ...cardStyle({ padding: spacing.xs, withBorder: false }),
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  playlistInfo: {
    padding: spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.xs,
  },
  playlistTitle: {
    ...typography.subheading,
    textAlign: 'center',
  },
  playlistCreator: {
    ...textVariants.subtitle,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...textVariants.subtitle,
  },
  shareContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  qrContainer: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrTitle: {
    ...typography.subheading,
    fontSize: 16,
  },
  qrCode: {
    width: 150,
    height: 150,
    borderRadius: radii.md,
  },
  qrSubtext: {
    ...textVariants.subtitle,
    textAlign: 'center',
  },
  shareOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  shareOption: {
    width: '48%',
    ...sectionStyle({ padding: spacing.md }),
    alignItems: 'center',
    gap: spacing.xs,
  },
  shareOptionText: {
    ...textVariants.subtitle,
    fontSize: 12,
    textAlign: 'center',
  },
  shareInfo: {
    ...sectionStyle({ padding: spacing.md }),
    gap: spacing.sm,
  },
  shareInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareInfoText: {
    ...textVariants.subtitle,
    flex: 1,
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  statsButtonText: {
    ...textVariants.subtitle,
    color: colors.accent,
    fontWeight: '600',
  },
  shareUrl: {
    color: colors.accent,
    fontSize: 12,
  },
  shareStats: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.xs,
  },
  shareStatsText: {
    ...textVariants.subtitle,
    textAlign: 'center',
  },
  errorContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...textVariants.danger,
    textAlign: 'center',
  },
  retryButton: {
    ...cardStyle({ padding: spacing.sm, withBorder: false }),
    backgroundColor: colors.accent,
  },
  retryButtonText: {
    ...typography.subheading,
    fontSize: 14,
    color: colors.background,
  },
}));

const ShareModal = ({ visible, onClose, playlist }) => {
  const dispatch = useAppDispatch();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);

  const generateShareLink = useCallback(async () => {
    if (!playlist?.id) {
      return;
    }

    setLoading(true);
    try {
      const result = await dispatch(createShareLinkAsync(playlist.id));
      if (result?.payload) {
        setShareData(result.payload);
      }
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [dispatch, playlist?.id]);

  useEffect(() => {
    if (visible && playlist?.id && !shareData && !loading) {
      generateShareLink();
    }
  }, [visible, playlist?.id, shareData, loading, generateShareLink]);

  const copyToClipboard = async () => {
    if (shareData?.share_url) {
      await Clipboard.setStringAsync(shareData.share_url);
      Alert.alert('복사 완료', '링크가 클립보드에 복사되었습니다.');
    }
  };

  const handleNativeShare = async () => {
    if (!shareData?.share_url || !playlist?.title) {
      return;
    }

    try {
      await Share.share({
        message: `🎵 Stonetify에서 "${playlist.title}" 플레이리스트를 확인해보세요!\n\n${shareData.share_url}`,
        url: shareData.share_url,
        title: `${playlist.title} - Stonetify`,
      });
    } catch (error) {
      console.error('공유 실패:', error);
    }
  };

  const getSocialMessage = (platform) => {
    const baseMessage = `🎵 "${playlist?.title ?? ''}" 플레이리스트를 공유합니다!`;
    const hashtags = '#Stonetify #플레이리스트 #음악공유';

    switch (platform) {
      case 'twitter':
        return `${baseMessage} ${shareData?.share_url ?? ''} ${hashtags}`.trim();
      case 'facebook':
        return `${baseMessage}\n\n${shareData?.share_url ?? ''}`.trim();
      case 'instagram':
        return `${baseMessage}\n링크는 바이오에서 확인하세요! ${hashtags}`.trim();
      default:
        return `${baseMessage}\n${shareData?.share_url ?? ''}`.trim();
    }
  };

  const handleClose = () => {
    setShareData(null);
    onClose?.();
  };

  const shareCreatedAt = useMemo(() => {
    if (!shareData?.created_at) {
      return null;
    }
    return new Date(shareData.created_at).toLocaleDateString('ko-KR');
  }, [shareData?.created_at]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>플레이리스트 공유</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={pressableHitSlop}
              accessibilityLabel="공유 모달 닫기"
            >
              <Ionicons name="close" size={22} color={palette.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle} numberOfLines={2}>
              {playlist?.title ?? '플레이리스트'}
            </Text>
            <Text style={styles.playlistCreator} numberOfLines={1}>
              By {playlist?.user?.display_name ?? 'Unknown'}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={styles.loadingText}>공유 링크 생성 중...</Text>
            </View>
          ) : shareData ? (
            <View style={styles.shareContent}>
              <View style={styles.qrContainer}>
                <Text style={styles.qrTitle}>QR 코드로 공유</Text>
                <Image source={{ uri: shareData.qr_code_url }} style={styles.qrCode} />
                <Text style={styles.qrSubtext}>QR 코드를 스캔하여 바로 접속</Text>
              </View>

              <View style={styles.shareOptions}>
                <TouchableOpacity
                  style={styles.shareOption}
                  onPress={copyToClipboard}
                  hitSlop={pressableHitSlop}
                >
                  <Ionicons name="copy-outline" size={24} color={palette.accent} />
                  <Text style={styles.shareOptionText}>링크 복사</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareOption}
                  onPress={handleNativeShare}
                  hitSlop={pressableHitSlop}
                >
                  <Ionicons name="share-outline" size={24} color={palette.accent} />
                  <Text style={styles.shareOptionText}>앱으로 공유</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareOption}
                  onPress={() => Share.share({ message: getSocialMessage('twitter') })}
                  hitSlop={pressableHitSlop}
                >
                  <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                  <Text style={styles.shareOptionText}>트위터</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareOption}
                  onPress={() => Share.share({ message: getSocialMessage('facebook') })}
                  hitSlop={pressableHitSlop}
                >
                  <Ionicons name="logo-facebook" size={24} color="#4267B2" />
                  <Text style={styles.shareOptionText}>페이스북</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.shareInfo}>
                <View style={styles.shareInfoRow}>
                  <Text style={styles.shareInfoText}>
                    공유된 날짜: {shareCreatedAt ?? '미확인'}
                  </Text>
                  <TouchableOpacity
                    style={styles.statsButton}
                    onPress={() => setStatsModalVisible(true)}
                    hitSlop={pressableHitSlop}
                  >
                    <Ionicons name="analytics-outline" size={16} color={palette.accent} />
                    <Text style={styles.statsButtonText}>통계</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.shareUrl} numberOfLines={1}>
                  {shareData.share_url}
                </Text>

                {typeof shareData.view_count === 'number' && typeof shareData.share_count === 'number' && (
                  <View style={styles.shareStats}>
                    <Text style={styles.shareStatsText}>
                      조회수: {shareData.view_count} • 공유수: {shareData.share_count}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color={palette.danger} />
              <Text style={styles.errorText}>공유 링크 생성에 실패했습니다</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={generateShareLink}
                hitSlop={pressableHitSlop}
              >
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ShareStatsModal
          visible={statsModalVisible}
          onClose={() => setStatsModalVisible(false)}
          playlistId={playlist?.id}
        />
      </View>
    </Modal>
  );
};

ShareModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  playlist: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    user: PropTypes.shape({
      display_name: PropTypes.string,
    }),
  }),
};

ShareModal.defaultProps = {
  playlist: null,
};

export default ShareModal;
