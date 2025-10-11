// Stonetify/Frontend/screens/HomeScreen.js

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Platform, Dimensions, Share, Alert, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts, toggleLikePost, toggleSavePost } from '../store/slices/postSlice';
import { fetchMyPlaylists, fetchLikedPlaylists, createShareLinkAsync, fetchRecommendedPlaylists, fetchForYouPlaylists } from '../store/slices/playlistSlice';
import PostCard from '../components/PostCard'; 
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import { useNavigation } from '@react-navigation/native';

const logoPurple = require('../assets/images/logo_purple.png');

const { width: screenWidth } = Dimensions.get('window');
const isMobile = Platform.OS !== 'web' && screenWidth < 768;

const HomeScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { posts = [], status: postStatus } = useSelector((state) => state.post);
  const { user } = useSelector((state) => state.auth);
  const { userPlaylists, recommendedPlaylists, forYouPlaylists } = useSelector((state) => state.playlist);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchPosts());
    dispatch(fetchMyPlaylists());
    dispatch(fetchLikedPlaylists());
    dispatch(fetchRecommendedPlaylists());
    dispatch(fetchForYouPlaylists());
  }, [dispatch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      dispatch(fetchPosts()),
      dispatch(fetchMyPlaylists()),
      dispatch(fetchLikedPlaylists()),
      dispatch(fetchRecommendedPlaylists()),
      dispatch(fetchForYouPlaylists())
    ]).finally(() => {
      setRefreshing(false);
    });
  }, [dispatch]);

  const handlePlaylistPress = (playlistId) => {
    if (playlistId) {
      navigation.navigate('PlaylistDetail', { playlistId });
    }
  };

  const handlePostShare = async (post) => {
        if (!post.playlist?.id) return Alert.alert('오류', '공유할 수 없는 플레이리스트입니다.');
        if (!user) return Alert.alert('로그인이 필요한 기능입니다.');
        try {
            const result = await dispatch(createShareLinkAsync(post.playlist.id)).unwrap();
            await Share.share({
                message: `Stonetify에서 "${post.playlist.title}" 플레이리스트를 확인해보세요!\n${result.share_url}`,
            });
        } catch (error) {
            Alert.alert('오류', '공유 링크 생성에 실패했습니다.');
        }
    };

  // ❗ --- 인기 피드 5개만 선택 --- ❗
    const popularPosts = useMemo(() => {
        if (!Array.isArray(posts)) return [];
        const postsCopy = [...posts];
        // 1. 'likesCount'가 높은 순서대로 정렬합니다.
        postsCopy.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        // 2. 상위 5개의 게시물만 잘라냅니다.
        return postsCopy.slice(0, 5);
    }, [posts]);

    if (postStatus === 'loading' && posts.length === 0) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#1DB954" /></View>;
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
            tintColor="#1DB954" // iOS용 로딩 색상
            colors={['#1DB954']} // Android용 로딩 색상
          />
        }
      >
        <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image source={logoPurple} style={styles.logo} />
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.greeting}>좋은 {new Date().getHours() < 12 ? '아침' : new Date().getHours() < 18 ? '오후' : '저녁'}이에요</Text>
              <Text style={styles.userName}>{user?.display_name || '사용자'}님</Text>
            </View>
        </View>

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
                <Text style={[styles.quickButtonText, styles.quickButtonSecondaryText]}>음악 검색</Text>
              </View>
            </TouchableOpacity>
        </View>

        <HorizontalPlaylist
          title="나의 플레이리스트"
          data={userPlaylists}
          onItemPress={(item) => handlePlaylistPress(item.id)}
          onSeeAll={() => navigation.navigate('Profile')}
        />

        <HorizontalPlaylist
          title={`${user?.display_name || '회원'}님을 위한 추천`}
          data={forYouPlaylists}
          onItemPress={(item) => handlePlaylistPress(item.id)}
        />

        <HorizontalPlaylist
          title="최신 플레이리스트"
          data={recommendedPlaylists}
          onItemPress={(item) => handlePlaylistPress(item.id)}
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
            popularPosts.map(post => (
                  <PostCard
                     key={post.id} 
                     item={post}
                     onPress={() => handlePlaylistPress(post.playlist?.id)}
                     onLikePress={() => user ? dispatch(toggleLikePost(post.id)) : Alert.alert('로그인이 필요한 기능입니다.')}
                     onSavePress={() => user ? dispatch(toggleSavePost(post.id)) : Alert.alert('로그인이 필요한 기능입니다.')}
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
  container: { flex: 1, backgroundColor: '#121212' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
    header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 20,
    paddingTop: isMobile ? 60 : 25,
    paddingBottom: isMobile ? 12 : 8,
    backgroundColor: '#121212',
  },
  headerLeft: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  logo: {
    width: isMobile ? 120 : 115,
    height: isMobile ? 100 : 100,
    contentFit: 'contain',
    marginLeft: -5,
  },
  greeting: {
    fontSize: 14,
    color: '#b3b3b3',
    fontWeight: '500',
    marginBottom: isMobile ? 6 : 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userName: { fontSize: 24, color: '#ffffff', fontWeight: '800', letterSpacing: -0.8 },
  quickAccessContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 24, gap: 12 },
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
    elevation: 8,
  },
  quickAccessSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#1DB954', shadowColor: 'transparent' },
  quickButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  quickButtonText: {
    color: '#121212',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickButtonSecondaryText: { color: '#1DB954' },
  scrollViewContent: { paddingBottom: 100, backgroundColor: '#121212' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: { 
    color: '#ffffff', 
    fontSize: 26, 
    fontWeight: '700', 
    letterSpacing: -0.5,
  },
  feedContainer: { 
    paddingHorizontal: 16 
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#a7a7a7',
  },
  seeAllButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
  },
  seeAllText: {
    color: '#b3b3b3',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;