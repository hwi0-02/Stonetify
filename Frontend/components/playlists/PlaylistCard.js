import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import placeholderAlbum from '../../assets/images/placeholder_album.png';
import { useDispatch, useSelector } from 'react-redux';
import { toggleLikePlaylist, deletePlaylist } from '../../store/slices/playlistSlice';
import ShareModal from './ShareModal';

// 플레이리스트 썸네일 (2x2 이미지 격자)
const PlaylistThumbnail = ({ coverImages, isLiked, onLikePress }) => {
  const imageSlots = Array(4).fill(null).map((_, index) => {
    const url = coverImages[index];
    return url ? { uri: url } : placeholderAlbum;
  });

  return (
    <View style={styles.thumbnailGrid}>
      <View style={styles.gridRow}>
        <Image source={imageSlots[0]} style={styles.gridImage} />
        <Image source={imageSlots[1]} style={styles.gridImage} />
      </View>
      <View style={styles.gridRow}>
        <Image source={imageSlots[2]} style={styles.gridImage} />
        <Image source={imageSlots[3]} style={styles.gridImage} />
      </View>
      <TouchableOpacity style={styles.thumbnailHeartButton} onPress={onLikePress}>
        <Ionicons 
          name={isLiked ? "heart" : "heart-outline"} 
          size={20} 
          color={isLiked ? "#1DB954" : "#ffffff"} 
        />
      </TouchableOpacity>
    </View>
  );
};

// 플레이리스트 카드 컴포넌트
const PlaylistCard = ({ playlist, onPress, showActions = true }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { likedPlaylists } = useSelector((state) => state.playlist);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const coverImages = playlist.cover_images || [];
  
  const isLiked = likedPlaylists.some(p => p.id === playlist.id);

  const handleLike = async () => {
    try {
      await dispatch(toggleLikePlaylist(playlist.id));
    } catch (error) {
      Alert.alert('오류', '좋아요 처리 중 문제가 발생했습니다.');
    }
  };

  const handleShare = () => {
    setShareModalVisible(true);
  };

  const handleDelete = async () => {
    Alert.alert(
      '플레이리스트 삭제',
      `"${playlist.title}"을(를) 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(deletePlaylist(playlist.id)).unwrap();
            } catch (e) {
              Alert.alert('오류', e || '삭제 중 문제가 발생했습니다.');
            }
          }
        }
      ],
      { cancelable: true }
    );
  };

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        <PlaylistThumbnail 
          coverImages={coverImages} 
          isLiked={isLiked}
          onLikePress={handleLike}
        />
        <View style={styles.playButton}>
          <Ionicons name="play" size={20} color="#121212" />
        </View>
        {showActions && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#ffffff" />
            </TouchableOpacity>
            {user && playlist.user_id === user.id && (
              <TouchableOpacity style={[styles.actionButton, { borderColor: '#ff4444' }]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#ff4444" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>{playlist.title}</Text>
        {playlist.description ? (
          <Text style={styles.description} numberOfLines={2}>{playlist.description}</Text>
        ) : null}
        {playlist.user?.display_name && (
          <Text style={styles.creator}>By {playlist.user.display_name}</Text>
        )}
      </View>
      
      <ShareModal 
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        playlist={playlist}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: 170,
    marginRight: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    transform: [{ scale: 1 }],
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  thumbnailGrid: {
    width: '100%',
    height: 138,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#282828',
  },
  gridRow: {
    flexDirection: 'row',
    flex: 1,
  },
  gridImage: {
    flex: 1,
    height: '100%',
    backgroundColor: '#282828',
    borderWidth: 0.5,
    borderColor: '#1a1a1a',
  },
  playButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    opacity: 0.9,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    color: '#a7a7a7',
    marginBottom: 6,
    lineHeight: 16,
    fontWeight: '500',
  },
  creator: {
    fontSize: 11,
    color: '#6a6a6a',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionButtons: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  thumbnailHeartButton: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default PlaylistCard;