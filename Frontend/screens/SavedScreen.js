import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../components/PostCard';
import { fetchSavedPosts, toggleLikePost, toggleSavePost } from '../store/slices/postSlice';
import { createShareLinkAsync } from '../store/slices/playlistSlice';
import { createStyles } from '../utils/ui';
import { textVariants, pressableHitSlop, iconButton as iconButtonStyle } from '../utils/uiComponents';
import { useAppDispatch, useAppSelector, selectAuthUser, selectPostState } from '../store/hooks';

const SavedScreen = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { savedPosts = [], status } = useAppSelector(selectPostState);
  const user = useAppSelector(selectAuthUser);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        dispatch(fetchSavedPosts());
      }
    }, [dispatch, user])
  );

  const handleLike = (postId) => {
    if (!user) {
      Alert.alert('로그인이 필요한 기능입니다.');
      return;
    }
    dispatch(toggleLikePost(postId));
  };

  const handleSave = (postId) => {
    if (!user) {
      Alert.alert('로그인이 필요한 기능입니다.');
      return;
    }
    dispatch(toggleSavePost(postId));
  };

  const handleShare = async (post) => {
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
  };

  if ((status === 'loading' || !user) && savedPosts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={styles.accentColor.color} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="arrow-back" size={22} color={styles.headerTitle.color} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>저장한 피드</Text>
        <View style={styles.headerSpacer} />
      </View>
      <FlatList
        data={savedPosts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.playlist?.id })}
            onLikePress={() => handleLike(item.id)}
            onSavePress={() => handleSave(item.id)}
            onSharePress={() => handleShare(item)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>저장한 피드가 없습니다.</Text>
            <Text style={styles.emptyDescription}>마음에 드는 게시물을 저장해 보세요.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = createStyles(({ colors, spacing, typography }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  accentColor: {
    color: colors.accent,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  paddingBottom: spacing.md,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: colors.divider,
  },
  backButton: {
    ...iconButtonStyle({ size: 40 }),
    backgroundColor: colors.surface,
  },
  headerTitle: {
    ...typography.heading,
    fontSize: 24,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: iconButtonStyle({ size: 40 }).width || 40,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  emptyContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl,
  },
  emptyTitle: {
    ...typography.subheading,
  },
  emptyDescription: {
    ...textVariants.subtitle,
    textAlign: 'center',
  },
}));

export default SavedScreen;
