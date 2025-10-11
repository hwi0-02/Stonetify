import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlaylistDetails, updatePlaylist, deletePlaylist, toggleLikePlaylist, createShareLinkAsync, fetchLikedPlaylists } from '../store/slices/playlistSlice';
import { playTrack } from '../store/slices/playerSlice';
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
  
  // ❗ user를 loggedInUser로 명확하게 변경하고, likedSongsMap을 가져옵니다.
  const { currentPlaylist, status, likedPlaylists } = useSelector((state) => state.playlist);
  const { user: loggedInUser } = useSelector((state) => state.auth);
  const likedSongsMap = useSelector(state => state.likedSongs.map); // ❗ 곡 좋아요 상태를 위해 추가
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  // const [isLiked, setIsLiked] = useState(false); 
  const [songLikes, setSongLikes] = useState({});

  useEffect(() => {
    if (playlistId) {
      dispatch(fetchPlaylistDetails(playlistId));
      dispatch(fetchLikedPlaylists());
    }
  }, [dispatch, playlistId]);

   useEffect(() => {
    if (currentPlaylist) {
      setEditTitle(currentPlaylist.title || '');
      setEditDescription(currentPlaylist.description || '');
      
      const map = {};
      for (const s of currentPlaylist.songs || []) {
        const key = s.id || s.spotify_id;
        map[key] = !!likedSongsMap[key];
      }
      setSongLikes(map);
    }
  }, [currentPlaylist, likedSongsMap]);
  
  // ❗ --- 수정/추가된 로직 --- ❗
  // 1. 현재 로그인한 사용자가 이 플레이리스트의 주인인지 확인합니다.
  const isOwner = currentPlaylist?.user_id === loggedInUser?.id;
  // 2. 이 플레이리스트가 내 보관함(좋아요 목록)에 있는지 확인합니다. (기존 isLiked 변수를 대체)
  const isSaved = likedPlaylists.some(p => p.id === currentPlaylist?.id);
  
  const handleEditPlaylist = () => {
    setMenuVisible(false);
    setEditModalVisible(true);
  };

   const handlePlayTrack = (song) => {
    // ❗ playTrackWithPlaylist 대신 playTrack 사용
    if (song.preview_url) {
        dispatch(playTrack(song));
        navigation.navigate('Player');
    } else {
        Alert.alert('미리듣기 없음', '이 곡은 미리듣기를 제공하지 않습니다.');
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

    if (Platform.OS === 'web') {
      const ok = window.confirm(`"${currentPlaylist?.title || '이 플레이리스트'}"을(를) 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
      if (ok) {
        (async () => {
          try {
            await dispatch(deletePlaylist(playlistId)).unwrap();
            navigation.navigate('Main', { screen: 'Home' });
          } catch (error) {
            console.error('❌ 플레이리스트 삭제 실패:', error);
            alert('삭제 실패: ' + (error || '오류가 발생했습니다.'));
          }
        })();
      }
      return;
    }

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
        if (Platform.OS === 'web') {
          alert('곡이 플레이리스트에서 제거되었습니다.');
        } else {
          Alert.alert('✅ 제거 완료', '곡이 플레이리스트에서 제거되었습니다.');
        }
      } catch (error) {
        console.error('❌ 곡 제거 실패:', error);
        const msg = `곡 제거 중 오류가 발생했습니다.\n\n${error.message || '알 수 없는 오류가 발생했습니다.'}`;
        if (Platform.OS === 'web') alert(msg); else Alert.alert('❌ 제거 실패', msg);
      }
    };

    if (Platform.OS === 'web') {
      const ok = window.confirm(`"${song.name || song.title}"을(를) 플레이리스트에서 제거하시겠습니까?`);
      if (ok) performRemove();
      return;
    }

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
  
  // ❗ --- 수정된 부분: '좋아요'와 '플레이리스트 담기' 핸들러 --- ❗
  // 두 기능 모두 '좋아요' API를 사용하므로 하나의 함수로 통합합니다.
  const handleToggleSaveAndLike = async () => {
    if (!loggedInUser) {
        return Alert.alert('로그인이 필요한 기능입니다.');
    }
    try {
      // Redux의 toggleLikePlaylist 액션을 호출합니다.
      await dispatch(toggleLikePlaylist(currentPlaylist.id)).unwrap();
      // 성공/실패 여부는 Redux 상태가 변경되면서 UI에 자동으로 반영됩니다.
      // 사용자에게 피드백을 주기 위해 Alert를 사용할 수 있습니다.
      const feedbackMessage = isSaved ? '내 보관함에서 삭제했습니다.' : '내 보관함에 저장했습니다.';
      // Alert.alert('완료', feedbackMessage); // 피드백이 너무 많으면 주석 처리 가능
    } catch (error) {
      Alert.alert('오류', '처리 중 문제가 발생했습니다.');
    }
  };

  if (status === 'loading' || !currentPlaylist) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8A2BE2" />
      </View>
    );
  }


  const handleShare = async () => {
    if (!currentPlaylist) return;
    try {
      // Redux Thunk를 통해 공유 링크를 생성하는 API를 호출합니다.
      const result = await dispatch(createShareLinkAsync(currentPlaylist.id)).unwrap();
      // React Native의 기본 공유 기능을 사용합니다.
      await Share.share({
        message: `Stonetify에서 "${currentPlaylist.title}" 플레이리스트를 확인해보세요!\n${result.share_url}`,
        url: result.share_url, // iOS에서는 url도 함께 전달하는 것이 좋습니다.
      });
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성에 실패했습니다.');
    }
  };

  if (status === 'loading' || !currentPlaylist) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#1DB954" /></View>;
  }

  const renderHeader = () => (
    <LinearGradient colors={['#4c1e6e', '#121212']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

      <PlaylistHeaderImage songs={currentPlaylist.songs || []} />
      <Text style={styles.title}>{currentPlaylist.title}</Text>
      {currentPlaylist.description ? (
        <Text style={styles.description}>{currentPlaylist.description}</Text>) : null}
      <Text style={styles.creator}> By {currentPlaylist.user?.display_name || 'Unknown User'}</Text>
      
      <View style={styles.actionButtons}>
         {/* ❗ --- 수정된 부분: 조건부 버튼 렌더링 --- ❗ */}
        {/* 소유자일 때만 '더보기' 메뉴 버튼 표시 */}
        {isOwner && (
            <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
                <Ionicons name="ellipsis-horizontal" size={24} color="white" />
            </TouchableOpacity>
        )}

        {/* 소유자가 아니고 로그인했을 때 '플레이리스트 담기' 버튼 표시 */}
        {!isOwner && loggedInUser && (
            <TouchableOpacity style={styles.actionButton} onPress={handleToggleSaveAndLike}>
                <Ionicons name={isSaved ? "checkmark-circle" : "add-circle-outline"} size={28} color={isSaved ? "#1DB954" : "white"} />
            </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.likeButton} onPress={handleToggleSaveAndLike}>
          {/* ❗ isLiked 대신 isSaved 사용 */}
          <Ionicons name={isSaved ? "heart" : "heart-outline"} size={24} color={isSaved ? "#1DB954" : "white"} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
        
        {currentPlaylist.songs && currentPlaylist.songs.length > 0 && (
          <TouchableOpacity style={styles.playButton} onPress={() => handlePlayTrack(currentPlaylist.songs[0])}>
            <Ionicons name="play-circle" size={60} color="#1DB954" />
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>

      {/* ❗ FlatList로 전체 화면을 감싸도록 구조 변경 (뒤로가기 버튼을 위에 띄우기 위함) */}
      <FlatList
        data={currentPlaylist.songs || []}
        keyExtractor={(item, index) => `${playlistId}:${item?.id ?? item?.spotify_id ?? index}`}
        renderItem={({ item, index }) => (
            <SongListItem 
              item={item}
              onPress={() => handlePlayTrack(item)}
               // ❗ 3. 소유자일 경우에만 곡 삭제 버튼을 보여줍니다.
              showRemoveButton={isOwner}
              onRemovePress={() => handleRemoveSong(item)}
              showLikeButton
              onLikePress={() => handleToggleSongLike(item)}
              liked={!!songLikes[item?.id || item?.spotify_id]}
            />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color="#404040" />
            <Text style={styles.emptyText}>이 플레이리스트에는 아직 곡이 없습니다</Text>
            {isOwner && <Text style={styles.emptySubtext}>곡을 추가해보세요</Text>}
          </View>
        )}
      />

       {/* ❗ 4. 소유자일 경우에만 수정/삭제 관련 모달을 렌더링합니다. */}
       {isOwner && (
        <>
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
      </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  backButton: { //뒤로가기 버튼
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
},
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
  actionButton: {
    padding: 8,
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