import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, Share } from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlaylistDetails, updatePlaylist, deletePlaylist, toggleLikePlaylist, createShareLinkAsync } from '../store/slices/playlistSlice';
import { playTrack, playTrackWithPlaylist } from '../store/slices/playerSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SongListItem from '../components/SongListItem';
import * as ApiService from '../services/apiService';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

// 4개 이미지 격자를 렌더링하는 컴포넌트
const PlaylistHeaderImage = ({ songs }) => {
  // Web과 Native 모두에서 작동하는 placeholder URL
  const placeholderUrl = require('../assets/images/placeholder_album.png');
  
  // 첫 4개 노래의 커버 이미지 추출 (부족한 경우 placeholder로 채움)
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
  const { currentPlaylist, status } = useSelector((state) => state.playlist);
  const { user } = useSelector((state) => state.auth);
  
  // 메뉴 모달 상태
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (playlistId) {
      dispatch(fetchPlaylistDetails(playlistId));
    }
  }, [dispatch, playlistId]);

  // 플레이리스트 정보가 로드되면 편집 폼 초기화
  useEffect(() => {
    if (currentPlaylist) {
      setEditTitle(currentPlaylist.title || '');
      setEditDescription(currentPlaylist.description || '');
      // 좋아요 상태 초기화 (실제로는 API에서 받아와야 함)
      setIsLiked(currentPlaylist.liked || false);
    }
  }, [currentPlaylist]);

  // 플레이리스트 수정 핸들러
  const handleEditPlaylist = () => {
    setMenuVisible(false);
    setEditModalVisible(true);
  };

  // 곡 재생 핸들러
  const handlePlayTrack = (song) => {
    dispatch(playTrackWithPlaylist(song, currentPlaylist.songs));
    navigation.navigate('Player');
  };

  // 플레이리스트 삭제 핸들러
  const handleDeletePlaylist = () => {
    console.log('플레이리스트 삭제 함수 호출됨');
    console.log('currentPlaylist:', currentPlaylist);
    
    setMenuVisible(false);
    
    Alert.alert(
      '⚠️ 플레이리스트 삭제',
      `"${currentPlaylist?.title}"을(를) 영구적으로 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 플레이리스트와 모든 곡이 삭제됩니다.`,
      [
        { 
          text: '취소', 
          style: 'cancel',
          onPress: () => {
            console.log('플레이리스트 삭제 취소됨');
          }
        },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('=== 플레이리스트 삭제 시작 ===');
              console.log('플레이리스트 ID:', currentPlaylist.id);
              console.log('플레이리스트 제목:', currentPlaylist.title);
              
              console.log('Redux deletePlaylist 액션 디스패치 중...');
              const result = await dispatch(deletePlaylist(currentPlaylist.id)).unwrap();
              console.log('Redux 액션 완료. 결과:', result);
              
              console.log('삭제 성공 알림 표시');
              Alert.alert('✅ 삭제 완료', '플레이리스트가 성공적으로 삭제되었습니다.');
              
              console.log('메인 화면으로 이동');
              navigation.navigate('Main');
            } catch (error) {
              console.error('=== 플레이리스트 삭제 실패 ===');
              console.error('오류 객체:', error);
              console.error('오류 메시지:', error?.message);
              console.error('오류 응답:', error?.response?.data);
              Alert.alert(
                '❌ 삭제 실패', 
                `플레이리스트 삭제 중 오류가 발생했습니다.\n\n${error?.message || '알 수 없는 오류가 발생했습니다.'}`
              );
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  // 플레이리스트 정보 저장 핸들러
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

  // 곡 삭제 핸들러 - 확인 대화상자 추가
  const handleRemoveSong = async (song) => {
    console.log('=== 삭제 함수 호출됨 ===');
    console.log('곡 정보:', song);
    console.log('플레이리스트 ID:', currentPlaylist?.id);
    
    Alert.alert(
      '🎵 곡 삭제',
      `"${song.name || song.title}"을(를) 플레이리스트에서 제거하시겠습니까?\n\n곡 자체는 삭제되지 않으며, 이 플레이리스트에서만 제거됩니다.`,
      [
        { 
          text: '취소', 
          style: 'cancel',
          onPress: () => {
            console.log('곡 삭제 취소됨');
          }
        },
        { 
          text: '제거', 
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('삭제 API 호출 중...');
              await ApiService.removeSongFromPlaylist(currentPlaylist.id, song.id);
              console.log('삭제 성공! 플레이리스트 새로고침...');
              
              // 플레이리스트 새로고침
              dispatch(fetchPlaylistDetails(currentPlaylist.id));
              
              Alert.alert('✅ 제거 완료', '곡이 플레이리스트에서 제거되었습니다.');
            } catch (error) {
              console.error('삭제 실패:', error);
              Alert.alert(
                '❌ 제거 실패', 
                `곡 제거 중 오류가 발생했습니다.\n\n${error?.message || '알 수 없는 오류가 발생했습니다.'}`
              );
            }
          }
        }
      ],
      { cancelable: false }
    );
  };

  // 좋아요 토글 핸들러
  const handleToggleLike = async () => {
    try {
      const result = await dispatch(toggleLikePlaylist(currentPlaylist.id));
      if (result.payload) {
        setIsLiked(result.payload.liked);
      }
    } catch (error) {
      Alert.alert('오류', '좋아요 처리 중 문제가 발생했습니다.');
    }
  };

  // 공유 핸들러
  const handleShare = async () => {
    try {
      const result = await dispatch(createShareLinkAsync(currentPlaylist.id));
      if (result.payload) {
        const shareUrl = result.payload.share_url;
        await Share.share({
          message: `Stonetify에서 "${currentPlaylist.title}" 플레이리스트를 확인해보세요!\n${shareUrl}`,
          url: shareUrl,
        });
      }
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성 중 문제가 발생했습니다.');
    }
  };

  // 현재 사용자가 플레이리스트 소유자인지 확인
  const isOwner = currentPlaylist && user && currentPlaylist.user_id === user.id;
  
  const imageUrl = currentPlaylist?.songs?.[0]?.album_cover_url;

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
      
      {/* 플레이리스트 메뉴와 재생 버튼 */}
      <View style={styles.actionButtons}>
        {/* 메뉴 버튼 (수정/삭제) - 소유자에게만 표시 */}
        {isOwner ? (
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
          </TouchableOpacity>
        ) : null}
        
        {/* 좋아요 버튼 */}
        <TouchableOpacity style={styles.likeButton} onPress={handleToggleLike}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#1DB954" : "white"} />
        </TouchableOpacity>
        
        {/* 공유 버튼 */}
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
        
        {/* 재생 버튼 */}
        {currentPlaylist.songs && currentPlaylist.songs.length > 0 ? (
          <TouchableOpacity 
            style={styles.playButton} 
            onPress={() => {
              const firstSong = currentPlaylist.songs[0];
              if (firstSong.preview_url) {
                dispatch(playTrackWithPlaylist({ 
                  track: firstSong, 
                  playlist: currentPlaylist.songs, 
                  index: 0 
                }));
                navigation.navigate('Player');
              } else {
                Alert.alert('알림', '이 트랙에는 미리 듣기가 없습니다.');
              }
            }}
          >
            <Ionicons name="play-circle" size={60} color="#1DB954" />
          </TouchableOpacity>
        ) : null}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      {/* 고정 뒤로가기 버튼 */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.fixedBackButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={currentPlaylist.songs || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <SongListItem 
            item={item}
            onPress={handlePlayTrack}
            showRemoveButton={true}
            onRemovePress={handleRemoveSong}
            showPlayButton={true}
            playlist={currentPlaylist.songs}
            index={index}
          />
        )}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={true}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color="#404040" />
            <Text style={styles.emptyText}>이 플레이리스트에는 아직 곡이 없습니다</Text>
            <Text style={styles.emptySubtext}>곡을 추가해보세요</Text>
          </View>
        )}
      />

      {/* 메뉴 모달 */}
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
                console.log('플레이리스트 삭제 버튼 클릭됨');
                setMenuVisible(false);
                handleDeletePlaylist();
              }}
            >
              <Ionicons name="trash-outline" size={24} color="#ff4444" />
              <Text style={[styles.menuItemText, styles.deleteMenuText]}>플레이리스트 삭제</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 편집 모달 */}
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
  playButton: {
    marginTop: 0,
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
  // 모달 스타일
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