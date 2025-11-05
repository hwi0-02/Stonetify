import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/apiService'; 

const placeholderProfile = require('../assets/images/placeholder_album.png');

const FollowingUserItem = ({ user, onUnfollow, onProfilePress }) => {
  const [isUnfollowing, setIsUnfollowing] = useState(false);

  const handleUnfollow = async () => {
    setIsUnfollowing(true);
    try {
      await onUnfollow(user.id);
    } catch (error) {
      Alert.alert('오류', '팔로우 취소 처리에 실패했습니다.');
    } finally {
      setIsUnfollowing(false);
    }
  };

  return (
    <TouchableOpacity style={styles.userItemContainer} onPress={() => onProfilePress(user.id)}>
      <Image
        source={user.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile}
        style={styles.avatarSmall}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userNameSmall}>{user.display_name || '알 수 없는 사용자'}</Text>
      </View>
      <TouchableOpacity
        style={styles.unfollowButton}
        onPress={handleUnfollow}
        disabled={isUnfollowing}
      >
        {isUnfollowing ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.unfollowButtonText}>팔로잉</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};


const FollowingListScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch(); 
  const { user: loggedInUser } = useSelector((state) => state.auth); 

  const [followingList, setFollowingList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFollowing = useCallback(async () => {
    if (!loggedInUser?.id) {
      setError('로그인이 필요합니다.');
      setIsLoading(false);
      setFollowingList([]); 
      return;
    }
    setIsLoading(true);
    setError(null); 
    try {
      const data = await apiService.getFollowing(loggedInUser.id);
      setFollowingList(Array.isArray(data) ? data : (data?.Followings || []));
    } catch (err) {
      console.error("팔로잉 목록 로딩 실패:", err);
      setError('팔로잉 목록을 불러오는 데 실패했습니다.');
      setFollowingList([]); 
    } finally {
      setIsLoading(false);
    }
  }, [loggedInUser?.id]); 

useFocusEffect(
    useCallback(() => {
      async function fetchFollowingData() {
        if (!loggedInUser?.id) {
          setError('로그인이 필요합니다.');
          setIsLoading(false);
          setFollowingList([]);
          return;
        }
        setIsLoading(true);
        setError(null);
        try {
          const data = await apiService.getFollowing(loggedInUser.id);
          setFollowingList(Array.isArray(data) ? data : (data?.Followings || []));
        } catch (err) {
          console.error("팔로잉 목록 로딩 실패:", err);
          setError('팔로잉 목록을 불러오는 데 실패했습니다.');
          setFollowingList([]);
        } finally {
          setIsLoading(false);
        }
      }

      fetchFollowingData();
    }, [loggedInUser?.id]) // 의존성 배열 유지
  );

  const handleUnfollowUser = async (followingUserId) => {
    try {
      await apiService.unfollowUser(followingUserId);
      fetchFollowing(); // 상태 업데이트를 위해 목록 다시 로드
    } catch (err) {
      console.error("팔로우 취소 실패:", err);
      throw err;
    }
  };

  const navigateToUserProfile = (userId) => {
    navigation.push('UserProfile', { userId }); 
  };

  // 로딩 중 표시
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#b04ad8ff" />
      </View>
    );
  }

  // 에러 발생 시 표시
  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color="#ff4444" style={{ marginBottom: 16 }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={fetchFollowing} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>팔로잉</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 팔로잉 목록 */}
      <FlatList
        data={followingList}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <FollowingUserItem
            user={item}
            onUnfollow={handleUnfollowUser}
            onProfilePress={navigateToUserProfile}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#6a6a6a" />
            <Text style={styles.emptyText}>아직 팔로우하는 사용자가 없습니다.</Text>
            <Text style={styles.emptySubText}>다른 사용자를 팔로우해 플레이리스트를 확인해보세요.</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
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
    paddingTop: 8, 
  },
  userItemContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  avatarSmall: { 
    width: 48,
    height: 48,
    borderRadius: 24, 
    backgroundColor: '#333',
    marginRight: 12,
  },
  userInfo: { 
    flex: 1, 
    marginRight: 12,
  },
  userNameSmall: { 
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  unfollowButton: { 
    backgroundColor: '#282828', 
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#555', 
    minWidth: 80, 
    alignItems: 'center',
  },
  unfollowButtonText: { 
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
    color: '#6a6a6a',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#b04ad8ff',
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

export default FollowingListScreen;