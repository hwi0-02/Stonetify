import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { fetchPosts } from '../store/slices/postSlice';
import { fetchUserPlaylists } from '../store/slices/playlistSlice';
import PostItem from '../components/home/PostItem';
import HorizontalPlaylist from '../components/HorizontalPlaylist';

const logoPurple = require('../assets/images/logo_purple.png');
const placeholderProfile = require('../assets/images/placeholder_album.png');

const HomeScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  // ❗수정된 부분: useSelector에서 posts를 가져올 때, 만약 값이 없으면 기본값으로 빈 배열([])을 사용하도록 합니다.
  const { posts = [], status: postStatus } = useSelector((state) => state.post);
  const { user } = useSelector((state) => state.auth);
  const { userPlaylists, status: playlistStatus } = useSelector((state) => state.playlist);

  useEffect(() => {
    dispatch(fetchPosts());
    if (user?.id) {
        dispatch(fetchUserPlaylists(user.id));
    }
  }, [dispatch, user]);

  const handlePlaylistPress = (playlistId) => {
    navigation.navigate('PlaylistDetail', { playlistId });
  };

  if (postStatus === 'loading' && posts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8A2BE2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{user?.display_name || 'Stonetify'} 님</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <HorizontalPlaylist
          title="나의 플레이리스트"
          data={userPlaylists}
          onItemPress={(item) => handlePlaylistPress(item.id)}
          onSeeAll={() => navigation.navigate('Profile')}
        />

        <Text style={styles.sectionTitle}>피드</Text>
        {/* ❗수정된 부분: Array.isArray()로 posts가 배열인지 한번 더 확인하여 안정성을 높입니다. */}
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
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000'},
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
    },
    headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    scrollViewContent: { paddingHorizontal: 15, paddingBottom: 80 },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginTop: 25 },
    emptyText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: '#a7a7a7',
    },
});

export default HomeScreen;