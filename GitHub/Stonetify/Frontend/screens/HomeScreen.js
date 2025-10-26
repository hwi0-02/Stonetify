import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchPosts,
  toggleLikePost,
  toggleSavePost,
} from '../store/slices/postSlice';
import {
  fetchMyPlaylists,
  fetchLikedPlaylists,
  createShareLinkAsync,
  fetchRecommendedPlaylists,
  fetchForYouPlaylists,
} from '../store/slices/playlistSlice';
import PostCard from '../components/PostCard';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import PopularChart from '../components/home/PopularChart'; // 추가
import { fetchPopularPlaylists } from '../store/slices/playlistSlice'; // 추가

const logoPurple = require('../assets/images/logo_purple.png');

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isMobile = !isWeb && screenWidth < 768;

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { posts = [], status: postStatus } = useSelector((state) => state.post);
  const { user } = useSelector((state) => state.auth);
  const { userPlaylists, recommendedPlaylists, forYouPlaylists, popularPlaylists } = useSelector((state) => state.playlist);
  const [refreshing, setRefreshing] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('weekly');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후예요';
    return '좋은 저녁이에요';
  };

  useEffect(() => {
    // 병렬 요청으로 로딩 속도 개선
    Promise.all([
      dispatch(fetchPosts()),
      dispatch(fetchMyPlaylists()),
      dispatch(fetchLikedPlaylists()),
      dispatch(fetchRecommendedPlaylists()),
      dispatch(fetchForYouPlaylists()),
      dispatch(fetchPopularPlaylists({ period: chartPeriod, limit: 3 })),
    ]).catch(err => console.error('홈 화면 데이터 로딩 실패:', err));
  }, [dispatch, chartPeriod]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      dispatch(fetchPosts()),
      dispatch(fetchMyPlaylists()),
      dispatch(fetchLikedPlaylists()),
      dispatch(fetchRecommendedPlaylists()),
      dispatch(fetchForYouPlaylists()),
    ])
      .finally(() => setRefreshing(false));
  }, [dispatch]);

  const handlePlaylistPress = (playlist) => {
    if (playlist?.id) {
      navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
    }
  };

  const handlePostShare = async (post) => {
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

  const popularPosts = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    const postsCopy = [...posts];
    postsCopy.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    return postsCopy.slice(0, 5);
  }, [posts]);

  if (postStatus === 'loading' && posts.length === 0) {
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
            onRefresh={onRefresh}
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
            onPress={() => navigation.navigate('CreatePlaylist')}
          >
            <View style={styles.quickButtonContent}>
              <Ionicons name="add" size={18} color="#121212" />
              <Text style={styles.quickButtonText}>플레이리스트 만들기</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickAccessButton, styles.quickAccessSecondary]}
            onPress={() => navigation.navigate('Search')}
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
          onSeeAll={() => navigation.navigate('Profile')}
        />

        <PopularChart
          title="Best 플레이리스트"
          data={popularPlaylists.slice(0, 3)}
          period={chartPeriod}
          onPeriodChange={setChartPeriod}
          onSeeAll={() => navigation.navigate('Chart')}
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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>피드</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Feed')}>
            <Text style={styles.seeAllText}>이동하기 &gt;</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.feedContainer}>
          {!Array.isArray(popularPosts) || popularPosts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>아직 피드가 없어요.</Text>
            </View>
          ) : (
            popularPosts.map((post) => (
              <PostCard
                key={post.id}
                item={post}
                onPress={() => handlePlaylistPress(post.playlist)}
                onLikePress={() =>
                  user ? dispatch(toggleLikePost(post.id)) : Alert.alert('로그인이 필요한 기능입니다.')
                }
                onSavePress={() =>
                  user ? dispatch(toggleSavePost(post.id)) : Alert.alert('로그인이 필요한 기능입니다.')
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212'
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 20,
    paddingTop: isWeb ? 5 : isMobile ? 40 : 25,
    paddingBottom: isWeb ? 5 : isMobile ? 8 : 6,
    backgroundColor: '#121212'
  },
  headerLeft: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  logo: {
    width: isWeb ? 110 : isMobile ? 120 : 115,
    height: isWeb ? 100 : isMobile ? 100 : 100,
    top: isWeb ? 10 : isMobile ? 15 : 8,
    contentFit: 'contain',
    marginLeft: -5
  },
  greeting: {
    fontSize: 14,
    color: '#b3b3b3',
    fontWeight: '500',
    marginBottom: isWeb ? 4 : isMobile ? 12 : 8,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  userName: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: -0.8
  },
  quickAccessContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12
  },
  quickAccessButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  quickAccessSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1DB954',
    shadowColor: 'transparent'
  },
  quickButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickButtonText: {
    color: '#121212',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  quickButtonSecondaryText: { color: '#1DB954' },
  scrollViewContent: { paddingBottom: 100, backgroundColor: '#121212' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  seeAllText: {
    color: '#b3b3b3',
    fontSize: 14,
    fontWeight: '600',
  },
  feedContainer: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#b3b3b3',
    paddingHorizontal: 32,
  },
});

export default HomeScreen;