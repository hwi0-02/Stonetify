import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../components/PostCard';
import { fetchPosts, toggleLikePost, toggleSavePost, deletePost } from '../store/slices/postSlice';
import { createShareLinkAsync } from '../store/slices/playlistSlice';

const MyFeedScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.auth);
  const { posts = [], status } = useSelector((state) => state.post);

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchPosts());
    }, [dispatch])
  );

  const myPosts = useMemo(() => {
    if (!user?.id || !Array.isArray(posts)) {
      return [];
    }
    return posts.filter(post => post.user?.id === user.id);
  }, [posts, user?.id]);


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
        url: result.share_url,
      });
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성 또는 공유에 실패했습니다.');
    }
  };

  const handleDelete = (postId) => {
     Alert.alert(
        "피드 삭제",
        "이 피드를 정말 삭제하시겠습니까?",
        [
            { text: "취소", style: "cancel" },
            {
                text: "삭제",
                onPress: () => {
                    dispatch(deletePost(postId))
                        .unwrap()
                        .catch(err => Alert.alert('삭제 실패', err.message || '삭제 중 오류가 발생했습니다.'));
                },
                style: "destructive"
            }
        ],
        { cancelable: true }
    );
  };

  const handlePlaylistPress = (playlistId) => {
    if (playlistId) {
      navigation.navigate('PlaylistDetail', { playlistId });
    }
  };


  if (status === 'loading' && myPosts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>내 피드</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 내가 쓴 게시물 목록 */}
      <FlatList
        data={myPosts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            onPress={() => handlePlaylistPress(item.playlist?.id)}
            onLikePress={() => handleLike(item.id)}
            onSavePress={() => handleSave(item.id)}
            onSharePress={() => handleShare(item)}
            canEdit={true}
            canDelete={true}
            onDeletePress={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#6a6a6a" />
            <Text style={styles.emptyText}>아직 작성한 피드가 없습니다.</Text>
            <Text style={styles.emptySubText}>플레이리스트를 공유하고 첫 피드를 작성해보세요.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60, 
    paddingBottom: 20,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#b3b3b3',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    color: '#6a6a6a',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorText: {
      color: '#ff4444',
      fontSize: 18,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
  },
  retryButton: {
      backgroundColor: '#1DB954',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
      marginTop: 16,
  },
  retryButtonText: {
      color: '#121212',
      fontSize: 16,
      fontWeight: 'bold',
  }
});

export default MyFeedScreen;