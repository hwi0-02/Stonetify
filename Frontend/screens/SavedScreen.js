import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../components/PostCard';
import { fetchSavedPosts, toggleLikePost, toggleSavePost } from '../store/slices/postSlice';
import { createShareLinkAsync } from '../store/slices/playlistSlice';

const SavedScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { savedPosts = [], savedStatus } = useSelector((state) => state.post);
  const { user } = useSelector((state) => state.auth);

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

  const isInitialLoading = savedStatus === 'loading' && savedPosts.length === 0;

  if ((isInitialLoading || !user) && savedPosts.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#b04ad8ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
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
            <Text style={styles.emptyText}>저장한 피드가 없습니다.</Text>
            <Text style={styles.emptySubText}>마음에 드는 게시물을 저장해 보세요.</Text>
          </View>
        )}
      />
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
    width: 40 
  },
  listContent: { 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    paddingBottom: 32 
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
});

export default SavedScreen;
