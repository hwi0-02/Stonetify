import React, { useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  Share,
  Alert,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../components/PostCard';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import SectionHeader from '../components/common/SectionHeader';
import EmptyState from '../components/common/EmptyState';
import { createStyles } from '../utils/ui';
import useHomeContent from '../hooks/useHomeContent';
import useNavigationActions from '../navigation/useNavigationActions';

const logoPurple = require('../assets/images/logo_purple.png');

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isMobile = !isWeb && screenWidth < 768;

const styles = createStyles(({ colors, spacing, typography, elevation }) => ({
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
  scrollViewContent: {
    paddingBottom: spacing.xxl + spacing.md,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: spacing.xs,
    paddingRight: spacing.lg,
    paddingTop: isWeb ? spacing.xs : isMobile ? spacing.xl : spacing.lg,
    paddingBottom: isWeb ? spacing.xs : isMobile ? spacing.sm : spacing.xs,
    backgroundColor: colors.background,
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  logo: {
    width: isWeb ? 110 : isMobile ? 120 : 115,
    height: isWeb ? 100 : isMobile ? 100 : 100,
    top: isWeb ? 10 : isMobile ? 15 : 8,
    contentFit: 'contain',
    marginLeft: -5,
  },
  greeting: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: isWeb ? spacing.xs : isMobile ? spacing.md : spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userName: {
    ...typography.heading,
    fontSize: 24,
    letterSpacing: -0.8,
  },
  quickAccessContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  quickAccessButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...elevation.overlay,
  },
  quickAccessSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
    shadowColor: 'transparent',
  },
  quickButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  quickButtonText: {
    color: '#121212',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickButtonSecondaryText: {
    color: colors.accent,
  },
  feedContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  feedEmptyWrapper: {
    paddingHorizontal: spacing.md,
  },
}));

const HomeScreen = () => {
  const {
    user,
    postStatus,
    userPlaylists,
    recommendedPlaylists,
    forYouPlaylists,
    refreshing,
    refresh,
    popularPosts,
    likePost,
    savePost,
    createShareLink,
  } = useHomeContent();
  const {
    goToPlaylistDetail,
    goToProfile,
    goToCreatePlaylist,
    goToSearch,
    goToFeed,
  } = useNavigationActions();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후예요';
    return '좋은 저녁이에요';
  };

  const handlePlaylistPress = useCallback((playlist) => {
    if (playlist?.id) {
      goToPlaylistDetail(playlist.id);
    }
  }, [goToPlaylistDetail]);

  const handlePostShare = useCallback(async (post) => {
    if (!post?.playlist?.id) {
      Alert.alert('오류', '공유할 수 없는 플레이리스트입니다.');
      return;
    }

    try {
      const shareLink = await createShareLink(post.playlist.id);
      await Share.share({
        message: `Stonetify에서 "${post.playlist.title}" 플레이리스트를 확인해보세요!\n${shareLink.share_url}`,
      });
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성에 실패했습니다.');
    }
  }, [createShareLink]);

  if (postStatus === 'loading' && popularPosts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#1DB954"
            colors={['#1DB954']}
          />
        }
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={logoPurple} style={styles.logo} />
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.display_name || '사용자'}님</Text>
          </View>
        </View>

        {/* Quick Access Buttons */}
        <View style={styles.quickAccessContainer}>
          <TouchableOpacity
            style={styles.quickAccessButton}
            onPress={goToCreatePlaylist}
          >
            <View style={styles.quickButtonContent}>
              <Ionicons name="add" size={18} color="#121212" />
              <Text style={styles.quickButtonText}>플레이리스트 만들기</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAccessButton, styles.quickAccessSecondary]}
            onPress={goToSearch}
          >
            <View style={styles.quickButtonContent}>
              <Ionicons name="musical-notes" size={18} color="#1DB954" />
              <Text
                style={[
                  styles.quickButtonText,
                  styles.quickButtonSecondaryText
                ]}
              >
                음악 검색
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 플레이리스트 */}
        <HorizontalPlaylist
          title="나의 플레이리스트"
          data={userPlaylists}
          onItemPress={handlePlaylistPress}
          onSeeAll={goToProfile}
        />

        <HorizontalPlaylist
          title={`${user?.display_name || '회원'}님을 위한 추천`}
          data={forYouPlaylists}
          onItemPress={handlePlaylistPress}
        />

        <HorizontalPlaylist
          title="최신 플레이리스트"
          data={recommendedPlaylists}
          onItemPress={handlePlaylistPress}
        />

        <SectionHeader title="피드" actionLabel="이동하기" onPressAction={goToFeed} />

        <View style={styles.feedContainer}>
          {!Array.isArray(popularPosts) || popularPosts.length === 0 ? (
            <View style={styles.feedEmptyWrapper}>
              <EmptyState title="아직 피드가 없어요" description="새로운 음악을 공유하면 이곳에서 확인할 수 있어요" icon="chatbubble-ellipses-outline" />
            </View>
          ) : (
            popularPosts.map((post) => (
              <PostCard
                key={post.id}
                item={post}
                onPress={() => handlePlaylistPress(post.playlist)}
                onLikePress={() =>
                  user ? likePost(post.id) : Alert.alert('로그인이 필요한 기능입니다.')
                }
                onSavePress={() =>
                  user ? savePost(post.id) : Alert.alert('로그인이 필요한 기능입니다.')
                }
                onSharePress={() => handlePostShare(post)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
