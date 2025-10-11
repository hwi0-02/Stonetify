import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlaylistDetails, updatePlaylist, deletePlaylist, toggleLikePlaylist, createShareLinkAsync, fetchLikedPlaylists } from '../store/slices/playlistSlice';
import { playTrackWithPlaylist } from '../store/slices/playerSlice';
import { fetchLikedSongs, toggleLikeSongThunk } from '../store/slices/likedSongsSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SongListItem from '../components/SongListItem';
import * as ApiService from '../services/apiService';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

// 4개 이미지 격자를 렌더링하는 컴포넌트
const PlaylistHeaderImage = ({ songs }) => {
  const placeholderUrl = require('../assets/images/placeholder_album.png');
  
  const imageUrls = Array(4).fill(null).map((_, index) => {
    return (songs && songs[index]?.album_cover_url) || null;
  });

  const getImageSource = (imageUrl) => {
    if (!imageUrl) {
      return placeholderUrl;
    }
    if (typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      return { uri: imageUrl };
    }
    return placeholderUrl;
  };

  return (
    <View style={styles.playlistImageGrid}>
      <View style={styles.imageRow}>
        <Image source={getImageSource(imageUrls[0])} style={styles.gridImage} />
        <Image source={getImageSource(imageUrls[1])} style={styles.gridImage} />
      </View>
      <View style={styles.imageRow}>
        <Image source={getImageSource(imageUrls[2])} style={styles.gridImage} />
        <Image source={getImageSource(imageUrls[3])} style={styles.gridImage} />
      </View>
    </View>
  );
};

const PlaylistDetailScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const { playlistId } = route.params;
  const { currentPlaylist, status, likedPlaylists } = useSelector((state) => state.playlist);
  const { map: likedSongsMap } = useSelector((state) => state.likedSongs);
  const { user } = useSelector((state) => state.auth);
  const spotify = useSelector((state) => state.spotify);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeInflight, setLikeInflight] = useState({});

  useEffect(() => {
    if (playlistId) {
      dispatch(fetchPlaylistDetails(playlistId));
      dispatch(fetchLikedPlaylists());
      dispatch(fetchLikedSongs());
    }
  }, [dispatch, playlistId]);

  useEffect(() => {
    if (currentPlaylist) {
      setEditTitle(currentPlaylist.title || '');
      setEditDescription(currentPlaylist.description || '');
      const liked = !!(likedPlaylists || []).find(p => p.id === currentPlaylist.id) || currentPlaylist.liked || false;
      setIsLiked(liked);
    }
  }, [currentPlaylist, likedPlaylists]);


  
  const handleEditPlaylist = () => {
    setMenuVisible(false);
    setEditModalVisible(true);
  };

  const handlePlayTrack = (song) => {
    dispatch(playTrackWithPlaylist(song, currentPlaylist.songs));
    navigation.navigate('Player');
  };

  const handlePlayAll = async () => {
    if (!currentPlaylist?.songs?.length) {
      Alert.alert('알림', '플레이리스트에 곡이 없습니다.');
      return;
    }

    try {
      // If Spotify full-track requires auth, route to Profile to connect then auto-play
      const needsSpotify = !spotify?.accessToken || !spotify?.isPremium;
      if (needsSpotify) {
        navigation.navigate('Main', {
          screen: 'Profile',
          params: {
            postConnect: {
              action: 'playAll',
              // Pass minimal data needed to start playback
              playlist: currentPlaylist.songs,
            }
          }
        });
        return;
      }

      await dispatch(playTrackWithPlaylist({ playlist: currentPlaylist.songs }));
      navigation.navigate('Player');
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.message || '재생에 실패했습니다.';
      Alert.alert('재생 실패', message);
    }
  };

  // ❗ [수정됨] 최종 삭제 핸들러 로직
  const handleDeletePlaylist = () => {
    console.log('🚨 handleDeletePlaylist 함수 호출됨!');
    console.log('playlistId:', playlistId);
    console.log('currentPlaylist:', currentPlaylist);
    
    // route.params에서 받은 playlistId가 가장 확실한 값
    if (!playlistId) {
      console.log('❌ playlistId가 없음');
      Alert.alert('❌ 오류', '플레이리스트 ID가 없어 삭제할 수 없습니다.');
      return;
    }

    console.log('📱 Alert.alert 호출 시도...');
    setMenuVisible(false); // 메뉴를 먼저 닫아 UI 충돌 방지

    Alert.alert(
      '⚠️ 플레이리스트 삭제',
      `"${currentPlaylist?.title || '이 플레이리스트'}"을(를) 정말로 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없으며, 플레이리스트와 모든 곡이 영구적으로 삭제됩니다.`,
      [
        {
          text: '취소',
          style: 'cancel',
          onPress: () => console.log('✋ 플레이리스트 삭제 취소됨')
        },
        {
          text: '영구 삭제',
          style: 'destructive',
          onPress: async () => {
            console.log('💥 삭제 확인됨 - 실제 삭제 시작');
            try {
              console.log('🗑️ 플레이리스트 삭제 시작:', playlistId);
              await dispatch(deletePlaylist(playlistId)).unwrap();
              navigation.navigate('Main', { screen: 'Home' });
            } catch (error) {
              console.error('❌ 플레이리스트 삭제 실패:', error);
              Alert.alert('❌ 삭제 실패', error || '플레이리스트 삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ],
      { cancelable: false }
    );
    console.log('📱 Alert.alert 호출 완료');
  };
  
  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      Alert.alert('오류', '플레이리스트 제목을 입력해주세요.');
      return;
    }

    try {
      await dispatch(updatePlaylist({ 
        playlistId: currentPlaylist.id, 
        playlistData: { 
          title: editTitle.trim(), 
          description: editDescription.trim() 
        }
      })).unwrap();
      
      Alert.alert('성공', '플레이리스트가 수정되었습니다.');
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert('오류', error || '플레이리스트 수정에 실패했습니다.');
    }
  };

  const handleRemoveSong = (song) => {
    console.log('🎵 handleRemoveSong 함수 호출됨!');
    console.log('song:', song);
    
    const performRemove = async () => {
      console.log('💥 곡 제거 확인됨 - 실제 제거 시작');
      try {
        console.log('🗑️ 곡 제거 시작:', { playlistId: currentPlaylist.id, songId: song.id });
        await ApiService.removeSongFromPlaylist(currentPlaylist.id, song.id);
        dispatch(fetchPlaylistDetails(currentPlaylist.id));
        Alert.alert('✅ 제거 완료', '곡이 플레이리스트에서 제거되었습니다.');
      } catch (error) {
        console.error('❌ 곡 제거 실패:', error);
        const msg = `곡 제거 중 오류가 발생했습니다.\n\n${error.message || '알 수 없는 오류가 발생했습니다.'}`;
        Alert.alert('❌ 제거 실패', msg);
      }
    };

    // 모든 플랫폼에서 Alert.alert 사용

    Alert.alert(
      '🎵 곡 제거',
      `"${song.name || song.title}"을(를) 플레이리스트에서 제거하시겠습니까?\n\n💡 곡 자체는 삭제되지 않으며, 이 플레이리스트에서만 제거됩니다.`,
      [
        { text: '취소', style: 'cancel', onPress: () => console.log('✋ 곡 제거 취소됨') },
        { text: '제거', style: 'destructive', onPress: performRemove },
      ],
      { cancelable: false }
    );
  };
  
  const handleToggleLike = async () => {
    try {
      const result = await dispatch(toggleLikePlaylist(currentPlaylist.id)).unwrap();
      setIsLiked(result.liked);
    } catch (error) {
      Alert.alert('오류', '좋아요 처리 중 문제가 발생했습니다.');
    }
  };

  const handleToggleSongLike = async (song) => {
    const key = song?.id || song?.spotify_id;
    if (!key) return;
    if (likeInflight[key]) return;
    setLikeInflight(prev => ({ ...prev, [key]: true }));
    try {
      await dispatch(toggleLikeSongThunk(song)).unwrap();
    } catch (e) {
      const msg = e?.message || '곡 좋아요 처리 중 오류가 발생했습니다.';
      Alert.alert('오류', msg);
    } finally {
      setLikeInflight(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };
  
  const handleShare = async () => {
    try {
      const result = await dispatch(createShareLinkAsync(currentPlaylist.id)).unwrap();
      const shareUrl = result.share_url;
      await Share.share({
        message: `Stonetify에서 "${currentPlaylist.title}" 플레이리스트를 확인해보세요!\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성 중 문제가 발생했습니다.');
    }
  };

  // 소유자 확인 (디버깅 추가)
  const isOwner = currentPlaylist && user && currentPlaylist.user_id === user.id;
  console.log('🔍 isOwner 디버깅:', {
    currentPlaylist: !!currentPlaylist,
    user: !!user,
    currentPlaylistUserId: currentPlaylist?.user_id,
    userId: user?.id,
    isOwner
  });

  if (status === 'loading' || !currentPlaylist) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8A2BE2" />
      </View>
    );
  }

  const renderHeader = () => (
    <LinearGradient colors={['#4c1e6e', '#121212']} style={styles.header}>
      <PlaylistHeaderImage songs={currentPlaylist.songs || []} />
      <Text style={styles.title}>{currentPlaylist.title}</Text>
      {currentPlaylist.description ? (
        <Text style={styles.description}>{currentPlaylist.description}</Text>
      ) : null}
      <Text style={styles.creator}>
        By {currentPlaylist.user?.display_name || 'Unknown User'}
      </Text>
      
      <View style={styles.actionButtons}>
        {/* 디버깅을 위해 임시로 항상 표시 */}
        <TouchableOpacity style={styles.menuButton} onPress={() => {
          console.log('🎯 메뉴 버튼 클릭됨');
          setMenuVisible(true);
        }}>
          <Ionicons name="ellipsis-horizontal" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.likeButton} onPress={handleToggleLike}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#1DB954" : "white"} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
        
        {currentPlaylist.songs && currentPlaylist.songs.length > 0 && (
          <TouchableOpacity
            style={styles.playAllButton}
            onPress={handlePlayAll}
          >
            <Ionicons name="play" size={18} color="#121212" style={styles.playAllIcon} />
            <Text style={styles.playAllText}>전체재생</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.fixedBackButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={currentPlaylist.songs || []}
        keyExtractor={(item, index) => `${playlistId}:${item?.id ?? item?.spotify_id ?? index}`}
        renderItem={({ item, index }) => {
          if (!item) return null;
          return (
            <SongListItem 
              item={item}
              onPress={() => handlePlayTrack(item)}
              showRemoveButton={isOwner}
              onRemovePress={handleRemoveSong}
              showLikeButton
              onLikePress={handleToggleSongLike}
              liked={!!(likedSongsMap[item?.id] || likedSongsMap[item?.spotify_id])}
            />
          );
        }}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color="#404040" />
            <Text style={styles.emptyText}>이 플레이리스트에는 아직 곡이 없습니다</Text>
            {isOwner && <Text style={styles.emptySubtext}>곡을 추가해보세요</Text>}
          </View>
        )}
      />

      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.menuModal}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditPlaylist}>
              <Ionicons name="create-outline" size={24} color="#ffffff" />
              <Text style={styles.menuItemText}>플레이리스트 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, styles.deleteMenuItem]} 
              onPress={() => {
                console.log('🔴 삭제 메뉴 아이템 클릭됨');
                handleDeletePlaylist();
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
              <Text style={[styles.menuItemText, styles.deleteMenuText]}>플레이리스트 삭제</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>플레이리스트 수정</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.editForm}>
              <Text style={styles.inputLabel}>제목</Text>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="플레이리스트 제목을 입력하세요"
                placeholderTextColor="#666"
              />
              
              <Text style={styles.inputLabel}>설명</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="플레이리스트 설명을 입력하세요"
                placeholderTextColor="#666"
                multiline={true}
                numberOfLines={4}
              />
              
              <View style={styles.editActions}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.cancelButton]} 
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.saveButton]} 
                  onPress={handleSaveEdit}
                >
                  <Text style={styles.saveButtonText}>저장</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 100,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  fixedBackButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  playlistImageGrid: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  imageRow: {
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  description: {
    color: '#b3b3b3',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  creator: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600'
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 20,
  },
  menuButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1DB954',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginLeft: 12,
  },
  playAllIcon: {
    marginRight: 8,
  },
  playAllText: {
    color: '#121212',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a7a7a7',
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModal: {
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  deleteMenuItem: {
    borderTopWidth: 1,
    borderTopColor: '#404040',
  },
  menuItemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteMenuText: {
    color: '#ff4444',
  },
  editModal: {
    backgroundColor: '#282828',
    borderRadius: 12,
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  editTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editForm: {
    padding: 20,
  },
  inputLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#404040',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#555',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#404040',
  },
  saveButton: {
    backgroundColor: '#1DB954',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  likeButton: {
    marginRight: 16,
  },
  shareButton: {
    marginRight: 16,
  },
});

export default PlaylistDetailScreen;
