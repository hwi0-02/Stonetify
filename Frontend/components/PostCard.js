import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { View, Text, Image, TouchableOpacity, Modal, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store/hooks';
import { deletePost } from '../store/slices/postSlice';
import { createStyles } from '../utils/ui';
import uiComponents, { card as cardStyle, listItem as listItemStyle, textVariants } from '../utils/uiComponents';
import { format } from '../utils';
import useNavigationActions from '../navigation/useNavigationActions';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const PostCard = ({
  item,
  onPress,
  onLikePress,
  onSavePress,
  onSharePress,
  isCompact = false,
}) => {
  const dispatch = useAppDispatch();
  const { goToProfile, goToUserProfile, goToWriteFeed } = useNavigationActions();
  const { user: loggedInUser } = useSelector((state) => state.auth);
  const [menuVisible, setMenuVisible] = useState(false);

  const postUser = item?.user || {};
  const playlist = item?.playlist || {};

  const postContent = useMemo(() => {
    const raw = item?.content;
    if (!raw) return { title: '제목 없음' };
    if (typeof raw === 'object') return raw;
    if (typeof raw !== 'string') return { title: '제목 없음' };
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : { title: raw };
    } catch (error) {
      return { title: raw };
    }
  }, [item?.content]);

  const styles = useMemo(() => createStyles(({ colors, spacing, radii, typography }) => ({
    container: {
      ...(isCompact ? cardStyle({ padding: spacing.sm }) : cardStyle({ padding: spacing.md })),
      marginBottom: isCompact ? spacing.md : spacing.lg,
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    profileImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    userName: {
      ...typography.subheading,
      fontSize: 16,
    },
    content: {
      gap: spacing.xs,
    },
    postTitle: {
      ...typography.subheading,
      fontSize: 18,
    },
    contentText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    playlistContainer: {
      ...cardStyle({ padding: 0, withBorder: false, muted: true }),
      flexDirection: 'row',
      overflow: 'hidden',
    },
    coverImage: {
      width: isCompact ? 64 : 80,
      height: isCompact ? 64 : 80,
      backgroundColor: colors.muted,
    },
    playlistInfo: {
      flex: 1,
      padding: spacing.md,
      gap: spacing.xs,
      justifyContent: 'center',
    },
    playlistTitle: {
      ...typography.subheading,
      fontSize: isCompact ? 15 : 17,
    },
    playlistDescription: {
      ...typography.body,
      color: colors.textMuted,
    },
    playlistMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    timestamp: {
      ...textVariants.meta,
      textAlign: 'right',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    actionButton: {
      ...listItemStyle({ withDivider: false, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }),
      borderRadius: radii.pill,
      backgroundColor: colors.muted,
    },
    actionButtonActive: {
      backgroundColor: colors.accent,
    },
    actionText: {
      ...typography.caption,
      fontWeight: '600',
    },
    modalOverlay: uiComponents.modalOverlay,
    menuContainer: {
      ...cardStyle({ padding: 0, withBorder: false }),
      width: 260,
      overflow: 'hidden',
    },
    menuItem: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      alignItems: 'center',
    },
    menuText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
    },
    deleteText: textVariants.danger,
  })), [isCompact]);

  const isMyPost = loggedInUser?.id === postUser.id;
  const coverImageSource = playlist.cover_image_url
    ? { uri: playlist.cover_image_url }
    : placeholderProfile;
  const playlistSongCount = playlist.songCount ?? playlist.song_count ?? playlist.songs?.length;
  const createdLabel = useMemo(() => format.timeAgo(item?.createdAt), [item?.createdAt]);

  const handleNavigateProfile = () => {
    if (!postUser.id) return;
    if (isMyPost) {
      goToProfile();
      return;
    }
    goToUserProfile(postUser.id);
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      '게시물 삭제',
      '정말로 이 게시물을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => dispatch(deletePost(item.id)),
        },
      ],
    );
  };

  const handleEdit = () => {
    setMenuVisible(false);
  goToWriteFeed(item);
  };

  return (
    <View style={styles.container}>
      {!isCompact && (
        <>
          <View style={styles.header}>
            <TouchableOpacity style={styles.userInfo} onPress={handleNavigateProfile}>
              <Image
                source={postUser.profile_image_url ? { uri: postUser.profile_image_url } : placeholderProfile}
                style={styles.profileImage}
              />
              <Text style={styles.userName}>{postUser.display_name || '사용자'}</Text>
            </TouchableOpacity>
            {isMyPost && (
              <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={uiComponents.pressableHitSlop}>
                <Ionicons name="ellipsis-horizontal" size={24} color={styles.userName.color} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.content}>
            <Text style={styles.postTitle}>{postContent.title}</Text>
            {postContent.description ? (
              <Text style={styles.contentText}>{postContent.description}</Text>
            ) : null}
          </View>
        </>
      )}

      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={styles.playlistContainer}>
          <Image source={coverImageSource} style={styles.coverImage} />
          <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle} numberOfLines={1}>
              {playlist.title || '플레이리스트'}
            </Text>
            <View style={styles.playlistMetaRow}>
              <Text style={styles.playlistDescription} numberOfLines={1}>
                {playlist.description || '소개가 아직 없습니다'}
              </Text>
              {playlistSongCount ? (
                <Text style={styles.playlistDescription}>{`${playlistSongCount}곡`}</Text>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {!isCompact && (
        <>
          <Text style={styles.timestamp}>{createdLabel}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, item.isLiked && styles.actionButtonActive]}
              onPress={onLikePress}
              hitSlop={uiComponents.pressableHitSlop}
            >
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={item.isLiked ? '#121212' : styles.actionText.color}
              />
              <Text style={styles.actionText}>{item.likesCount || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, item.isSaved && styles.actionButtonActive]}
              onPress={onSavePress}
              hitSlop={uiComponents.pressableHitSlop}
            >
              <Ionicons
                name={item.isSaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={item.isSaved ? '#121212' : styles.actionText.color}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onSharePress}
              hitSlop={uiComponents.pressableHitSlop}
            >
              <Ionicons name="share-social-outline" size={20} color={styles.actionText.color} />
            </TouchableOpacity>
          </View>

          {isMyPost && (
            <Modal
              visible={menuVisible}
              animationType="fade"
              transparent
              onRequestClose={() => setMenuVisible(false)}
            >
              <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setMenuVisible(false)}
              >
                <View style={styles.menuContainer}>
                  <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                    <Text style={styles.menuText}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                    <Text style={styles.deleteText}>삭제</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          )}
        </>
      )}
    </View>
  );
};

PostCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    content: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    likesCount: PropTypes.number,
    isLiked: PropTypes.bool,
    isSaved: PropTypes.bool,
    playlist: PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      description: PropTypes.string,
      cover_image_url: PropTypes.string,
      songs: PropTypes.array,
      song_count: PropTypes.number,
      songCount: PropTypes.number,
    }),
    user: PropTypes.shape({
      id: PropTypes.string,
      display_name: PropTypes.string,
      profile_image_url: PropTypes.string,
    }),
  }).isRequired,
  onPress: PropTypes.func,
  onLikePress: PropTypes.func,
  onSavePress: PropTypes.func,
  onSharePress: PropTypes.func,
  isCompact: PropTypes.bool,
};

PostCard.defaultProps = {
  onPress: undefined,
  onLikePress: undefined,
  onSavePress: undefined,
  onSharePress: undefined,
  isCompact: false,
};

export default PostCard;
