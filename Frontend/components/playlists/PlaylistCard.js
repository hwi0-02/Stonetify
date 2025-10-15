import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import placeholderAlbum from '../../assets/images/placeholder_album.png';
import { colors as palette, createStyles } from '../../utils/ui';
import {
  card as cardStyle,
  iconButton as iconButtonStyle,
  textVariants,
  pressableHitSlop,
} from '../../utils/uiComponents';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleLikePlaylist, deletePlaylist } from '../../store/slices/playlistSlice';
import ShareModal from './ShareModal';

const styles = createStyles(({ colors, spacing, radii, typography, elevation }) => ({
  cardContainer: {
    ...cardStyle({ padding: spacing.md, interactive: true }),
    width: 180,
    gap: spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  thumbnailGrid: {
    width: '100%',
    height: 140,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  gridRow: {
    flexDirection: 'row',
    flex: 1,
  },
  gridImage: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.shadow,
  },
  thumbnailHeartButton: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    ...iconButtonStyle({ size: 36 }),
    backgroundColor: colors.overlay,
  },
  playButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.overlay,
  },
  infoContainer: {
    gap: spacing.xs,
  },
  title: {
    ...typography.subheading,
    fontSize: 16,
  },
  description: {
    ...textVariants.subtitle,
    fontSize: 13,
  },
  creator: {
    ...textVariants.meta,
    textTransform: 'uppercase',
  },
  actionButtons: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    ...iconButtonStyle({ size: 36 }),
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  deleteButton: {
    borderColor: colors.danger,
  },
  deleteIcon: {
    color: colors.danger,
  },
}));

const PlaylistThumbnail = ({ coverImages, isLiked, onLikePress }) => {
  const imageSlots = useMemo(() => (
    Array(4)
      .fill(null)
      .map((_, index) => {
        const url = coverImages[index];
        return url ? { uri: url } : placeholderAlbum;
      })
  ), [coverImages]);

  return (
    <View style={styles.thumbnailGrid}>
      <View style={styles.gridRow}>
        <Image source={imageSlots[0]} style={styles.gridImage} />
        <Image source={imageSlots[1]} style={styles.gridImage} />
      </View>
      <View style={styles.gridRow}>
        <Image source={imageSlots[2]} style={styles.gridImage} />
        <Image source={imageSlots[3]} style={styles.gridImage} />
      </View>
      <TouchableOpacity
        style={styles.thumbnailHeartButton}
        onPress={onLikePress}
        hitSlop={pressableHitSlop}
      >
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={20}
          color={isLiked ? palette.accent : '#ffffff'}
        />
      </TouchableOpacity>
    </View>
  );
};

PlaylistThumbnail.propTypes = {
  coverImages: PropTypes.arrayOf(PropTypes.string).isRequired,
  isLiked: PropTypes.bool,
  onLikePress: PropTypes.func.isRequired,
};

PlaylistThumbnail.defaultProps = {
  isLiked: false,
};

const PlaylistCard = ({ playlist, onPress, showActions, coverOnly }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const likedPlaylists = useAppSelector((state) => state.playlist.likedPlaylists);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const coverImages = playlist.cover_images || [];
  const isLiked = likedPlaylists.some((p) => p.id === playlist.id);
  const isOwner = user && playlist.user_id === user.id;

  const handleLike = async () => {
    try {
      await dispatch(toggleLikePlaylist(playlist.id));
    } catch (error) {
      Alert.alert('오류', '좋아요 처리 중 문제가 발생했습니다.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '플레이리스트 삭제',
      `"${playlist.title}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deletePlaylist(playlist.id)).unwrap();
            } catch (error) {
              Alert.alert('오류', error?.message || '삭제 중 문제가 발생했습니다.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.imageContainer}>
        <PlaylistThumbnail coverImages={coverImages} isLiked={isLiked} onLikePress={handleLike} />
        <View style={styles.playButton}>
          <Ionicons name="play" size={20} color={palette.background} />
        </View>
        {showActions && !coverOnly ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShareModalVisible(true)}
              hitSlop={pressableHitSlop}
            >
              <Ionicons name="share-outline" size={20} color={palette.textPrimary} />
            </TouchableOpacity>
            {isOwner ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDelete}
                hitSlop={pressableHitSlop}
              >
                <Ionicons name="trash-outline" size={20} style={styles.deleteIcon} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      {!coverOnly ? (
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2}>
            {playlist.title || '제목 없는 플레이리스트'}
          </Text>
          {playlist.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {playlist.description}
            </Text>
          ) : null}
          {playlist.user?.display_name ? (
            <Text style={styles.creator}>By {playlist.user.display_name}</Text>
          ) : null}
        </View>
      ) : null}

      {!coverOnly ? (
        <ShareModal
          visible={shareModalVisible}
          onClose={() => setShareModalVisible(false)}
          playlist={playlist}
        />
      ) : null}
    </TouchableOpacity>
  );
};

PlaylistCard.propTypes = {
  playlist: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    cover_images: PropTypes.arrayOf(PropTypes.string),
    user_id: PropTypes.string,
    user: PropTypes.shape({
      display_name: PropTypes.string,
    }),
  }).isRequired,
  onPress: PropTypes.func,
  showActions: PropTypes.bool,
  coverOnly: PropTypes.bool,
};

PlaylistCard.defaultProps = {
  onPress: undefined,
  showActions: true,
  coverOnly: false,
};

export default PlaylistCard;