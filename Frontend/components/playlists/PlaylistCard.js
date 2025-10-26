import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import placeholderAlbum from '../../assets/images/placeholder_album.png';
import { toggleLikePlaylist, deletePlaylist } from '../../store/slices/playlistSlice';
import { useDispatch, useSelector } from 'react-redux';
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

  const [recommended, setRecommended] = useState([]);
  const [recommendCount, setRecommendCount] = useState(playlist.recommendCount || 0);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  
  const isLiked = likedPlaylists.some(p => p.id === playlist.id);

  // 최초 마운트 시에만 localStorage에서 값 불러오기
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    // 추천한 목록
    const data = localStorage.getItem('recommendedPlaylists');
    if (data) {
      try {
        setRecommended(JSON.parse(data));
      } catch {
        setRecommended([]);
      }
    }
    // 추천수
    const storedCounts = localStorage.getItem('recommendCounts');
    if (storedCounts) {
      try {
        const parsed = JSON.parse(storedCounts);
        if (parsed && typeof parsed[playlist.id] === 'number') {
          setRecommendCount(parsed[playlist.id]);
        } else {
          setRecommendCount(playlist.recommendCount || 0);
        }
      } catch {
        setRecommendCount(playlist.recommendCount || 0);
      }
    } else {
      setRecommendCount(playlist.recommendCount || 0);
    }
    initialized.current = true;
    // eslint-disable-next-line
  }, [playlist.id]);

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

  const handleRecommend = () => {
    let newCount;
    let newRecommended;

    if (recommended.includes(playlist.id)) {
      // 이미 추천한 경우: 추천 취소
      newCount = Math.max(recommendCount - 1, 0);
      newRecommended = recommended.filter(id => id !== playlist.id);
    } else {
      // 추천하지 않은 경우: 추천 추가
      newCount = recommendCount + 1;
      newRecommended = [...recommended, playlist.id];
    }

    setRecommendCount(newCount);
    setRecommended(newRecommended);
    localStorage.setItem('recommendedPlaylists', JSON.stringify(newRecommended));

    // 추천수도 localStorage에 저장
    let recommendCounts = {};
    const storedCounts = localStorage.getItem('recommendCounts');
    if (storedCounts) {
      try {
        recommendCounts = JSON.parse(storedCounts);
      } catch {}
    }
    recommendCounts[playlist.id] = newCount;
    localStorage.setItem('recommendCounts', JSON.stringify(recommendCounts));
  };

  // 최근에 본 플레이리스트 등에서 creator, cover_images, user 정보가 다를 수 있으니 보정
  const displayName =
    playlist.user?.display_name ||
    playlist.creator ||
    playlist.user_name ||
    'Unknown User';

  // cover_images가 없으면 songs 배열에서 4개 곡의 앨범 커버를 추출
  let coverImages = playlist.cover_images || [];
  if ((!coverImages || coverImages.length === 0) && playlist.songs && playlist.songs.length > 0) {
    coverImages = playlist.songs.slice(0, 4).map(song =>
      song.album_cover_url || song.cover_image_url || song.image || null
    );
  }

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
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{playlist.title}</Text>
          <TouchableOpacity
            style={styles.recommendBtn}
            onPress={handleRecommend}
          >
            <Ionicons
              name="thumbs-up-outline"
              size={16}
              color={recommended.includes(playlist.id) ? "#1DB954" : "#888"}
            />
            <Text style={styles.recommendCount}>{recommendCount}</Text>
          </TouchableOpacity>
        </View>
        {playlist.description ? (
          <Text style={styles.description} numberOfLines={2}>{playlist.description}</Text>
        ) : null}
        <Text style={styles.creator}>By {displayName}</Text>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // 제목 왼쪽, 추천버튼 오른쪽
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 20,
    letterSpacing: -0.2,
    flexShrink: 1,
    maxWidth: 90, // 제목이 너무 길면 추천버튼과 겹치지 않게
  },
  recommendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 14,
    paddingHorizontal: 12, // 좌우 적당히
    paddingVertical: 9,    // 상하 적당히 (1.5배 느낌)
    marginLeft: 8,
    minWidth: 44,
    minHeight: 33,         // 버튼 높이(처음의 1.5배 정도)
    justifyContent: 'center',
  },
  recommendCount: {
    color: '#1DB954',
    fontWeight: 'bold',
    marginLeft: 6,
    fontSize: 16,
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