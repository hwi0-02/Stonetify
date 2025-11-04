import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Share,
  Modal, 
} from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchPosts,
  toggleLikePost,
  toggleSavePost,
} from '../store/slices/postSlice';
import { createShareLinkAsync } from '../store/slices/playlistSlice';
import PostCard from '../components/PostCard';
import { MINI_PLAYER_HEIGHT } from '../components/MiniPlayer';
import { showToast } from '../utils/toast';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const FeedScreen = ({ navigation }) => {
  const dispatch = useDispatch();

  // useSelector 최적화
  const { posts = [], status } = useSelector(
    (state) => state.post,
    (prev, next) => prev.posts === next.posts && prev.status === next.status
  );
  const { user } = useSelector((state) => state.auth);
  const showMiniPlayer = useSelector(
    state => Boolean(state.player.currentTrack && !state.player.isPlayerScreenVisible)
  );

  const [tab, setTab] = useState('latest');
  const [refreshing, setRefreshing] = useState(false);

  // 초기 로드 시에만 데이터를 가져옴
  useEffect(() => {
    dispatch(fetchPosts());
  }, [dispatch]);

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

  // 항목 모달
  const navigateFromMenu = (screenName) => {
    setModalVisible(false); 
    navigation.navigate(screenName);
  };

  const renderPost = ({ item }) => (
    <PostCard
      item={item}
      onPress={() => {
        if (item.playlist?.id) {
          navigation.navigate('PlaylistDetail', { playlistId: item.playlist.id });
        }
      }}
      onLikePress={() => {
        if (user) {
          dispatch(toggleLikePost(item.id));
        } else {
          Alert.alert('로그인이 필요한 기능입니다.');
        }
      }}
      onSavePress={() => {
        if (user) {
          dispatch(toggleSavePost(item.id))
            .unwrap()
            .then((result) => {
              if (result.saved) {
                showToast('피드를 저장했습니다.', 2000);
              } else {
                showToast('저장을 취소했습니다.', 2000);
              }
            });
        } else {
          Alert.alert('로그인이 필요한 기능입니다.');
        }
      }}
      onSharePress={() => handlePostShare(item)}
      isLiked={item.isLiked}
      isSaved={item.isSaved}
    />
  );

  if (status === 'loading' && posts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>피드</Text>
          <View style={styles.headerActions} />
          </View>
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#b04ad8ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>피드</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Saved')} style={styles.iconButton}>
            <Ionicons name="bookmark-outline" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.userRow}>
        <Image
          source={user?.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile}
          style={styles.avatar}
          cachePolicy="memory-disk"
          contentFit="cover"
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
        // Virtual List 최적화
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={10}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 400, 
          offset: 400 * index,
          index,
        })}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#b04ad8ff"
            colors={['#b04ad8ff']}
          />
        }
        ListEmptyComponent={() => (
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

      <Modal
        transparent={true}
        visible={modalVisible}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setModalVisible(false)}
        >

        <TouchableOpacity activeOpacity={1} style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
            {/* 메뉴 아이템 */}
            <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('MyFeedScreen')}>
              <Ionicons name="reader-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>내가 작성한 피드</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('FollowingList')}>
              <Ionicons name="people-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>팔로잉</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('LikedPosts')}>
              <Ionicons name="heart-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>좋아요한 피드</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => navigateFromMenu('Saved')}>
              <Ionicons name="bookmark-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>저장한 피드</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>

      </Modal>

      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: showMiniPlayer ? 15 + MINI_PLAYER_HEIGHT : 15 }
        ]}
        onPress={() => navigation.navigate('WriteFeed')}
      >
        <Ionicons name="pencil" size={24} color="#FFFFFF" />
      </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#121212',
  },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333' },
  username: { color: '#ffffff', fontSize: 18, marginLeft: 12, flex: 1, fontWeight: '600' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#282828' },
  tabItem: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#b04ad8ff' },
  tabText: { color: '#b3b3b3', fontSize: 15, fontWeight: '500' },
  tabTextActive: { color: '#ffffff', fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 20 },
  emptyText: { color: '#ffffff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptySubText: { color: '#b3b3b3', fontSize: 14, marginTop: 8, textAlign: 'center' },
modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'flex-start', 
    alignItems: 'flex-end', 
  },
  menuContainer: {
    backgroundColor: '#282828', 
    borderRadius: 8,
    marginTop: 100, 
    marginRight: 10,
    minWidth: 200, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    overflow: 'hidden', 
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a', 
  },
  menuItemText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#b04ad8ff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default FeedScreen;
