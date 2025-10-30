import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { deletePost } from '../store/slices/postSlice';
import { showToast } from '../utils/toast';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const PostCard = memo(({ item, onPress, onLikePress, onSavePress, onSharePress, isCompact = false }) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user: loggedInUser } = useSelector(state => state.auth);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const postUser = item?.user || {};
  const playlist = item?.playlist || {};

  let postContent = item?.content;
  if (typeof postContent === 'string') {
    try {
      postContent = JSON.parse(postContent);
    } catch (error) {
      postContent = { title: postContent };
    }
  }
  postContent = postContent || { title: '제목 없음' };
  const isMyPost = loggedInUser?.id === postUser.id;
  const coverImageSource = playlist.cover_image_url ? { uri: playlist.cover_image_url } : require('../assets/images/placeholder_album.png');
  const playlistSongCount = playlist.songCount ?? playlist.song_count ?? playlist.songs?.length;

  const navigateToProfile = () => {
    if (!postUser.id) return;
    if (isMyPost) {
      navigation.navigate('Main', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { userId: postUser.id });
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = String(hours).padStart(2, '0');
    return `${month}월 ${day}일 ${ampm} ${formattedHours}:${minutes}`;
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setDeleteConfirmVisible(true);
  };

  const confirmDeletePost = () => {
    dispatch(deletePost(item.id))
      .unwrap()
      .then(() => {
        setDeleteConfirmVisible(false);
        showToast('피드를 삭제했습니다.', 2000);
      })
      .catch((error) => {
        setDeleteConfirmVisible(false);
        Alert.alert('오류', error?.message || '피드 삭제에 실패했습니다.');
      });
  };

  const handleEdit = () => {
    setMenuVisible(false);
    navigation.navigate('WriteFeed', { post: item });
  };

  return (
    <View style={isCompact ? styles.cardContainerCompact : styles.cardContainer}>
      {!isCompact && (
        <>
          <View style={styles.header}>
            <TouchableOpacity style={styles.userInfo} onPress={navigateToProfile}>
              <Image
                source={postUser.profile_image_url ? { uri: postUser.profile_image_url } : placeholderProfile}
                style={styles.profileImage}
              />
              <Text style={styles.userName}>{postUser.display_name || '사용자'}</Text>
            </TouchableOpacity>
            {isMyPost && (
              <TouchableOpacity onPress={() => setMenuVisible(true)}>
                <Ionicons name="ellipsis-horizontal" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.content}>
            <Text style={styles.postTitle}>{postContent.title}</Text>
            {postContent.description ? (
              <Text style={styles.contentText}>{postContent.description}</Text>
            ) : null}
          </View>
        </>
      )}

      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <View style={styles.playlistContainer}>
          <Image source={coverImageSource} style={styles.coverImage} />
          <View style={styles.playlistInfo}>
            <Text style={isCompact ? styles.playlistTitleCompact : styles.playlistTitle} numberOfLines={1}>
              {playlist.title || '플레이리스트'}
            </Text>
            <View style={styles.playlistMetaRow}>
              <Text style={isCompact ? styles.playlistDescriptionCompact : styles.playlistDescription} numberOfLines={1}>
                {playlist.description ? `${playlist.description}` : ''}
              </Text>
              <Text style={isCompact ? styles.playlistDescriptionCompact : styles.playlistDescription} numberOfLines={1}>
                  {playlistSongCount ? `${playlistSongCount}곡` : ''}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {!isCompact && (
        <>
          <Text style={styles.timestamp}>{formatTimestamp(item.createdAt)}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={onLikePress}>
              <Ionicons
                name={item.isLiked ? 'heart' : 'heart-outline'}
                size={26}
                color={item.isLiked ? '#1DB954' : '#b3b3b3'}
              />
              <Text style={styles.actionText}>{item.likesCount || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onSavePress}>
              <Ionicons
                name={item.isSaved ? 'bookmark' : 'bookmark-outline'}
                size={24}
                color={item.isSaved ? '#1DB954' : '#b3b3b3'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onSharePress}>
              <Ionicons name="share-social-outline" size={24} color="#b3b3b3" />
            </TouchableOpacity>
          </View>

          {isMyPost && (
            <Modal
              visible={menuVisible}
              animationType="fade"
              transparent
              onRequestClose={() => setMenuVisible(false)}
            >
              <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                <View style={styles.menuContainer}>
                  <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                    <Text style={styles.menuText}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.menuItem, styles.deleteItem]} onPress={handleDelete}>
                    <Text style={[styles.menuText, styles.deleteText]}>삭제</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {isMyPost && (
            <Modal
              visible={deleteConfirmVisible}
              animationType="fade"
              transparent
              onRequestClose={() => setDeleteConfirmVisible(false)}
            >
              <View style={styles.confirmOverlay}>
                <View style={styles.confirmContainer}>
                  <Text style={styles.confirmTitle}>피드를 삭제할까요?</Text>
                  <Text style={styles.confirmDescription}>삭제하면 되돌릴 수 없습니다.</Text>
                  <View style={styles.confirmButtonRow}>
                    <TouchableOpacity
                      style={[styles.confirmButton, styles.confirmCancelButton]}
                      onPress={() => setDeleteConfirmVisible(false)}
                    >
                      <Text style={[styles.confirmButtonText, styles.confirmCancelText]}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.confirmButton, styles.confirmDeleteButton]}
                      onPress={confirmDeletePost}
                    >
                      <Text style={[styles.confirmButtonText, styles.confirmDeleteText]}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#282828',
  },
  cardContainerCompact: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  playlistTitleCompact: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  playlistDescriptionCompact: {
    color: '#b3b3b3',
    fontSize: 12,
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  postTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  contentText: {
    color: '#b3b3b3',
    fontSize: 15,
    lineHeight: 22,
  },
  playlistContainer: {
    flexDirection: 'row',
    backgroundColor: '#282828',
    marginHorizontal: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  coverImage: {
    width: 80,
    height: 80,
    backgroundColor: '#333',
  },
  playlistInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  playlistTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  playlistDescription: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 4,
  },
  playlistMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopColor: '#282828',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    color: '#b3b3b3',
    marginLeft: 6,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    backgroundColor: '#282828',
    borderRadius: 10,
    width: 250,
    overflow: 'hidden',
  },
  menuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  menuText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  deleteItem: {
    borderBottomWidth: 0,
  },
  deleteText: {
    color: '#ff4d4d',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  confirmContainer: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1E1E',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  confirmButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmCancelButton: {
    marginRight: 12,
    backgroundColor: '#F2F2F2',
  },
  confirmDeleteButton: {
    backgroundColor: '#6C4DFF',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmCancelText: {
    color: '#6C4DFF',
  },
  confirmDeleteText: {
    color: '#ffffff',
  },
});

export default PostCard;
