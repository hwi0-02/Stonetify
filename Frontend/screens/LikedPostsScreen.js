import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../components/PostCard';
import { fetchLikedPosts, toggleLikePost } from '../store/slices/postSlice';
import { createShareLinkAsync } from '../store/slices/playlistSlice';

const LikedPostsScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { likedPosts = [], likedStatus, likedError } = useSelector((state) => state.post);
  const { user } = useSelector((state) => state.auth);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        dispatch(fetchLikedPosts()); 
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

  if ((likedStatus === 'loading' || !user) && likedPosts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#b04ad8ff" />
      </View>
    );
  }

   if (likedStatus === 'failed') {
     return (
       <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff4444" style={{ marginBottom: 16 }} />
         <Text style={styles.errorText}>좋아요한 게시물을 불러올 수 없습니다.</Text>
         {likedError && <Text style={styles.errorDetailText}>{likedError}</Text>}
          <TouchableOpacity onPress={() => dispatch(fetchLikedPosts())} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
       </View>
     );
   }


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>좋아요한 게시물</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={likedPosts} 
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <PostCard
            item={item}
            onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.playlist?.id })}
            onLikePress={() => handleLike(item.id)}
            onSharePress={() => handleShare(item)}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-dislike-outline" size={48} color="#6a6a6a" />
            <Text style={styles.emptyText}>좋아요한 게시물이 없습니다.</Text>
            <Text style={styles.emptySubText}>마음에 드는 게시물에 좋아요를 눌러보세요.</Text>
          </View>
        )}
      />
    </View>
  );
};

// 스타일은 SavedScreen과 거의 동일하게 사용
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
  errorDetailText: { // 에러 상세 텍스트
      color: '#b3b3b3',
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
  },
  retryButton: { // 다시 시도 버튼
      backgroundColor: '#b04ad8ff',
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
  },
  retryButtonText: { // 다시 시도 버튼 텍스트
      color: '#121212',
      fontSize: 16,
      fontWeight: 'bold',
  }
});

export default LikedPostsScreen;