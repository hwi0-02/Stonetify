import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, Platform, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../store/slices/postSlice';
import { fetchMyPlaylists, fetchLikedPlaylists } from '../store/slices/playlistSlice';
import PostItem from '../components/home/PostItem';
import HorizontalPlaylist from '../components/HorizontalPlaylist';

const logoPurple = require('../assets/images/logo_purple.png');
const placeholderProfile = require('../assets/images/placeholder_album.png');

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isMobile = !isWeb && screenWidth < 768;

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { posts = [], status: postStatus } = useSelector((state) => state.post);
  const { user } = useSelector((state) => state.auth);
  const { userPlaylists, status: playlistStatus } = useSelector((state) => state.playlist);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '아침';
    if (hour < 18) return '오후';
    return '저녁';
  };

  useEffect(() => {
    dispatch(fetchPosts());
    dispatch(fetchMyPlaylists());
    dispatch(fetchLikedPlaylists());
  }, [dispatch]);

  const handlePlaylistPress = (playlist) => {
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  };

  if (postStatus === 'loading' && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isWeb ? (
        // 웹에서는 기존 고정 헤더 유지
        <>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image source={logoPurple} style={styles.logo} />
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.greeting}>좋은아침이에요</Text>
              <Text style={styles.userName}>{user?.display_name || '사용자'}님</Text>
            </View>
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
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
                  <Text style={[styles.quickButtonText, styles.quickButtonSecondaryText]}>음악 검색</Text>
                </View>
              </TouchableOpacity>
            </View>
            <HorizontalPlaylist
              title="나의 플레이리스트"
              data={userPlaylists}
              onItemPress={(item) => {
                handlePlaylistPress(item);
              }}
              onSeeAll={() => navigation.navigate('Profile')}
            />

            <Text style={styles.sectionTitle}>피드</Text>
            {!Array.isArray(posts) || posts.length === 0 ? (
              <Text style={styles.emptyText}>아직 공유된 플레이리스트가 없어요.</Text>
            ) : (
              posts.map(post => (
                <PostItem
                  key={post.id}
                  post={post}
                  onPlaylistPress={() => handlePlaylistPress(post.playlist.id)}
                />
              ))
            )}
          </ScrollView>
        </>
      ) : (
        // 모바일에서는 헤더를 ScrollView 안으로 이동
        <ScrollView 
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 모바일용 헤더 */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image source={logoPurple} style={styles.logo} />
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.greeting}>좋은아침이에요</Text>
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
                <Text style={[styles.quickButtonText, styles.quickButtonSecondaryText]}>음악 검색</Text>
              </View>
            </TouchableOpacity>
          </View>
          <HorizontalPlaylist
            title="나의 플레이리스트"
            data={userPlaylists}
            onItemPress={(item) => {
              handlePlaylistPress(item);
            }}
            onSeeAll={() => navigation.navigate('Profile')}
          />

          <Text style={styles.sectionTitle}>피드</Text>
          {!Array.isArray(posts) || posts.length === 0 ? (
            <Text style={styles.emptyText}>아직 공유된 플레이리스트가 없어요.</Text>
          ) : (
            posts.map(post => (
              <PostItem
                key={post.id}
                post={post}
                onPlaylistPress={() => handlePlaylistPress(post.playlist.id)}
              />
            ))
          )}
        </ScrollView>
      )}
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
    paddingTop: isWeb ? 5 : (isMobile ? 40 : 25),
    paddingBottom: isWeb ? 5 : (isMobile ? 8 : 6),
    backgroundColor: '#121212',
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
    width: isWeb ? 110 : (isMobile ? 120 : 115),
    height: isWeb ? 100 : (isMobile ? 100 : 100),
    top: isWeb ? 10 : (isMobile ? 15 : 8),
    contentFit: 'contain',
    marginLeft: -5,
  },
  greeting: {
    fontSize: 14,
    color: '#b3b3b3',
    fontWeight: '500',
    marginBottom: isWeb ? 4 : (isMobile ? 12 : 8),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  userName: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  quickAccessContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  quickAccessButton: {
    flex: 1,
    backgroundColor: '#1DB954',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#1DB954',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  quickAccessSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#1DB954',
    shadowColor: 'transparent',
  },
  quickButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: {
    color: '#121212',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickButtonSecondaryText: {
    color: '#1DB954',
  },
  scrollViewContent: { 
    paddingBottom: 100,
    backgroundColor: '#121212',
  },
  sectionTitle: { 
    color: '#ffffff', 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 16, 
    marginTop: 32,
    paddingHorizontal: 16,
    letterSpacing: -0.5,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 16,
    color: '#b3b3b3',
    paddingHorizontal: 32,
  },
});

export default HomeScreen;