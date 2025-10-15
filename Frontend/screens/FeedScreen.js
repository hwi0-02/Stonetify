import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors as palette, createStyles } from '../utils/ui';
import {
  iconButton as iconButtonStyle,
  textVariants,
  pressableHitSlop,
} from '../utils/uiComponents';
import PostCard from '../components/PostCard';
import { MINI_PLAYER_HEIGHT } from '../components/MiniPlayer';
import {
  fetchPosts,
  toggleLikePost,
  toggleSavePost,
} from '../store/slices/postSlice';
import { createShareLinkAsync } from '../store/slices/playlistSlice';
import {
  useAppDispatch,
  useAppSelector,
  selectAuthUser,
  selectPostState,
} from '../store/hooks';
import useNavigationActions from '../navigation/useNavigationActions';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const styles = createStyles(({ colors, spacing, typography, elevation, radii }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.heading,
    fontSize: 26,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    ...iconButtonStyle({ size: 42 }),
    backgroundColor: colors.surface,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.muted,
  },
  username: {
    ...typography.subheading,
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.subheading,
    textAlign: 'center',
  },
  emptySubText: {
    ...textVariants.subtitle,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.card,
  },
}));

const FeedScreen = () => {
  const dispatch = useAppDispatch();
  const { goTo, goToPlaylistDetail, goToWriteFeed } = useNavigationActions();
  const { posts = [], status } = useAppSelector(selectPostState);
  const user = useAppSelector(selectAuthUser);
  const showMiniPlayer = useAppSelector(
    (state) => Boolean(state.player.currentTrack && !state.player.isPlayerScreenVisible),
  );

  const [tab, setTab] = useState('latest');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchPosts());
    }, [dispatch]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    dispatch(fetchPosts()).finally(() => setRefreshing(false));
  }, [dispatch]);

  const sortedPosts = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    const postsCopy = [...posts];
    if (tab === 'popular') {
      return postsCopy
        .filter((post) => (post.likesCount || 0) > 0)
        .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    }
    return postsCopy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts, tab]);

  const handlePostShare = useCallback(async (post) => {
    if (!post?.playlist?.id) {
      Alert.alert('오류', '공유할 수 없는 플레이리스트입니다.');
      return;
    }
    try {
      const result = await dispatch(createShareLinkAsync(post.playlist.id)).unwrap();
      await Share.share({
        message: `Stonetify에서 "${post.playlist.title}" 플레이리스트를 확인해보세요!\n${result.share_url}`,
      });
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성에 실패했습니다.');
    }
  }, [dispatch]);

  const handleToggleLike = useCallback((postId) => {
    if (!user) {
      Alert.alert('로그인이 필요한 기능입니다.');
      return;
    }
    dispatch(toggleLikePost(postId));
  }, [dispatch, user]);

  const handleToggleSave = useCallback((postId) => {
    if (!user) {
      Alert.alert('로그인이 필요한 기능입니다.');
      return;
    }
    dispatch(toggleSavePost(postId));
  }, [dispatch, user]);

  const renderPost = useCallback(({ item }) => (
    <PostCard
      item={item}
      onPress={() => (item.playlist?.id ? goToPlaylistDetail(item.playlist.id) : undefined)}
      onLikePress={() => handleToggleLike(item.id)}
      onSavePress={() => handleToggleSave(item.id)}
      onSharePress={() => handlePostShare(item)}
    />
  ), [goToPlaylistDetail, handlePostShare, handleToggleLike, handleToggleSave]);

  if (status === 'loading' && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>피드</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => goTo('Saved')}
            style={styles.iconButton}
            hitSlop={pressableHitSlop}
          >
            <Ionicons name="bookmark-outline" size={22} color={palette.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.userRow}>
        <Image
          source={user?.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile}
          style={styles.avatar}
        />
        <Text style={styles.username}>{user?.display_name || '게스트'}님</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'popular' && styles.tabActive]}
          onPress={() => setTab('popular')}
        >
          <Text style={[styles.tabText, tab === 'popular' && styles.tabTextActive]}>인기글</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'latest' && styles.tabActive]}
          onPress={() => setTab('latest')}
        >
          <Text style={[styles.tabText, tab === 'latest' && styles.tabTextActive]}>최신글</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedPosts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        )}
        ListEmptyComponent={(
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {tab === 'popular' ? '인기 있는 피드가 없습니다.' : '피드가 없습니다.'}
            </Text>
            <Text style={styles.emptySubText}>
              {tab === 'popular'
                ? '나만의 플레이리스트를 공유하여 좋아요를 받아보세요.'
                : '최신글에 좋아요를 눌러보세요.'}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: showMiniPlayer ? MINI_PLAYER_HEIGHT + 24 : 24 },
        ]}
        onPress={() => goToWriteFeed()}
        hitSlop={pressableHitSlop}
      >
  <Ionicons name="pencil" size={24} color={palette.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

export default FeedScreen;
