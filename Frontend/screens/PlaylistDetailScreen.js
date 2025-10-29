import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlaylistDetails, updatePlaylist, toggleLikePlaylist, createShareLinkAsync, fetchLikedPlaylists, savePlaylistAsync, fetchMyPlaylists, deletePlaylistAsync } from '../store/slices/playlistSlice';
import ApiService from '../services/apiService';
import { playTrackWithPlaylist } from '../store/slices/playerSlice';
import { fetchLikedSongs, toggleLikeSongThunk } from '../store/slices/likedSongsSlice';
import { addRecentPlaylist } from '../store/slices/recentPlaylistsSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import SongListItem from '../components/SongListItem';

const hasPlayableIdentifier = (song) => {
  if (!song) return false;

  const candidateStrings = [
    song.uri,
    song.spotify_uri,
    song.spotifyUri,
    song.spotifyURI,
    song.spotify_id,
    song.spotifyId,
  ].filter((value) => typeof value === 'string' && value.trim().length > 0);

  if (candidateStrings.length > 0) {
    return true;
  }

  const fallbackId =
    song.id ||
    song.song_id ||
    song.track_id ||
    song.trackId ||
    song.songId ||
    null;

  if (fallbackId !== null && fallbackId !== undefined) {
    const fallbackString = String(fallbackId).trim();
    if (fallbackString.length > 0 && fallbackString !== '[object Object]') {
      return !fallbackString.startsWith('-');
    }
  }

  return false;
};

const filterPlayableSongs = (songs = []) =>
  songs.filter((song) => hasPlayableIdentifier(song));

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
  const { currentPlaylist, status, likedPlaylists, userPlaylists } = useSelector((state) => state.playlist);
  const { map: likedSongsMap } = useSelector((state) => state.likedSongs);
  const { user } = useSelector((state) => state.auth);
  const spotify = useSelector((state) => state.spotify);
  const { accessToken: spotifyAccessToken, isPremium: spotifyIsPremium } = spotify || {};
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeInflight, setLikeInflight] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useEffect(() => {
    if (playlistId) {
      dispatch(fetchPlaylistDetails(playlistId));
      dispatch(fetchLikedPlaylists());
      dispatch(fetchLikedSongs());
      dispatch(fetchMyPlaylists());
    }
  }, [dispatch, playlistId]);

  useFocusEffect(
    useCallback(() => {
      if (!playlistId) return;
      dispatch(fetchPlaylistDetails(playlistId));
      dispatch(fetchMyPlaylists());
    }, [dispatch, playlistId])
  );

  useEffect(() => {
    if (currentPlaylist) {
      setEditTitle(currentPlaylist.title || '');
      setEditDescription(currentPlaylist.description || '');
      const liked = !!(likedPlaylists || []).find(p => p.id === currentPlaylist.id) || currentPlaylist.liked || false;
      setIsLiked(liked);
    }
  }, [currentPlaylist, likedPlaylists]);

  useEffect(() => {
    if (!currentPlaylist || !currentPlaylist.id) {
      return;
    }

    const coverImages = Array.isArray(currentPlaylist.cover_images) && currentPlaylist.cover_images.length > 0
      ? currentPlaylist.cover_images
      : (currentPlaylist.songs || [])
          .slice(0, 4)
          .map((song) => song?.album_cover_url)
          .filter(Boolean);

    const coverImageUrl = coverImages.length > 0
      ? coverImages[0]
      : currentPlaylist.cover_image_url || null;

    dispatch(addRecentPlaylist({
      id: currentPlaylist.id,
      title: currentPlaylist.title,
      description: currentPlaylist.description,
      cover_images: coverImages,
      cover_image_url: coverImageUrl,
      user: currentPlaylist.user ? {
        id: currentPlaylist.user.id,
        display_name: currentPlaylist.user.display_name,
      } : null,
    }));
  }, [dispatch, currentPlaylist?.id]);

  const playableSongs = useMemo(
    () => filterPlayableSongs(currentPlaylist?.songs || []),
    [currentPlaylist?.songs]
  );

  const isOwner = useMemo(() => {
    return Boolean(currentPlaylist && user && currentPlaylist.user_id === user.id);
  }, [currentPlaylist, user]);

  const isAlreadySaved = useMemo(() => {
    if (!currentPlaylist || !Array.isArray(userPlaylists) || !user?.id) {
      return false;
    }

    const savedByOrigin = userPlaylists.some(
      (playlist) =>
        playlist.user_id === user.id &&
        playlist.saved_from_playlist_id === currentPlaylist.id
    );
    if (savedByOrigin) {
      return true;
    }

    const originalCreatorName = currentPlaylist.user?.display_name || 'Unknown';
    const playlistTitle = currentPlaylist.title || '';
    const expectedSavedTitle = `'${originalCreatorName}'님의 ${playlistTitle}`;
    return userPlaylists.some(
      (playlist) => playlist.user_id === user.id && playlist.title === expectedSavedTitle
    );
  }, [currentPlaylist, userPlaylists, user?.id]);

  const handleEditPlaylist = () => {
    setMenuVisible(false);
    setEditModalVisible(true);
  };

  const handlePlayTrack = useCallback(async (song) => {
    if (!song) {
      return;
    }

    if (!playableSongs.length) {
      Alert.alert('알림', '재생할 수 있는 곡이 없습니다.');
      return;
    }

    if (!hasPlayableIdentifier(song)) {
      Alert.alert('알림', '이 곡은 재생할 수 없어 목록에서 제외되었어요.');
      return;
    }

    const queueIndex = playableSongs.findIndex((candidate) => {
      if (candidate === song) return true;
      if (candidate?.id && song?.id && candidate.id === song.id) return true;
      if (candidate?.spotify_id && song?.spotify_id && candidate.spotify_id === song.spotify_id) return true;
      return false;
    });

    const targetIndex = queueIndex >= 0 ? queueIndex : 0;
    const trackToPlay = playableSongs[targetIndex];

    try {
      await dispatch(
        playTrackWithPlaylist({
          track: trackToPlay,
          playlist: playableSongs,
          index: targetIndex,
        })
      );
      navigation.navigate('Player');
    } catch (error) {
      const message =
        typeof error === 'string'
          ? error
          : error?.message || '재생에 실패했습니다.';
      Alert.alert('재생 실패', message);
    }
  }, [dispatch, navigation, playableSongs]);

  const handlePlayAll = useCallback(async () => {
    if (!playableSongs.length) {
      Alert.alert('알림', '재생할 수 있는 곡이 없습니다.');
      return;
    }

    try {
      const needsSpotify = !spotifyAccessToken || !spotifyIsPremium;
      if (needsSpotify) {
        navigation.navigate('Main', {
          screen: 'Profile',
          params: {
            postConnect: {
              action: 'playAll',
              playlist: currentPlaylist.songs,
            }
          }
        });
        return;
      }

      await dispatch(
        playTrackWithPlaylist({
          track: playableSongs[0],
          playlist: playableSongs,
          index: 0,
        })
      );
      navigation.navigate('Player');
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.message || '재생에 실패했습니다.';
      Alert.alert('재생 실패', message);
    }
  }, [dispatch, navigation, playableSongs, spotifyAccessToken, spotifyIsPremium]);

  const handleAddSongs = useCallback(() => {
    if (!isOwner) {
      Alert.alert('알림', '이 플레이리스트에 곡을 추가할 수 있는 권한이 없습니다.');
      return;
    }

    if (!currentPlaylist?.id) {
      Alert.alert('알림', '플레이리스트 정보를 불러오지 못했습니다.');
      return;
    }

    navigation.navigate('Main', {
      screen: 'Search',
      params: {
        targetPlaylistId: currentPlaylist.id,
        targetPlaylistTitle: currentPlaylist.title || '',
      },
    });
  }, [currentPlaylist?.id, currentPlaylist?.title, isOwner, navigation]);

  const showDeletionToast = useCallback(
    (message = '플레이리스트를 삭제했습니다.', duration = 2000) =>
      new Promise((resolve) => {
        if (toastTimerRef.current) {
          clearTimeout(toastTimerRef.current);
        }
        setToastMessage(message);
        setToastVisible(true);
        toastTimerRef.current = setTimeout(() => {
          setToastVisible(false);
          toastTimerRef.current = null;
          resolve();
        }, duration);
      }),
    []
  );

  const performPlaylistDeletion = useCallback(async () => {
    const targetPlaylistId = currentPlaylist?.id ?? playlistId;

    if (!targetPlaylistId) {
      setDeleteModalVisible(false);
      Alert.alert('❌ 오류', '플레이리스트 ID가 없어 삭제할 수 없습니다.');
      return;
    }

    try {
      await dispatch(deletePlaylistAsync(targetPlaylistId)).unwrap();
      await Promise.all([
        dispatch(fetchMyPlaylists()),
        dispatch(fetchLikedPlaylists()),
      ]);
      setDeleteModalVisible(false);
      await showDeletionToast('플레이리스트를 삭제했습니다.', 2000);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Profile' } }],
      });
    } catch (error) {
      setDeleteModalVisible(false);
      const message =
        typeof error === 'string'
          ? error
          : error?.message || '플레이리스트 삭제 중 오류가 발생했습니다.';
      Alert.alert('❌ 삭제 실패', message);
    }
  }, [currentPlaylist?.id, playlistId, dispatch, navigation, showDeletionToast]);

  const handleDeletePlaylist = useCallback(() => {
    setMenuVisible(false);
    setDeleteModalVisible(true);
  }, []);

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

  const handleSavePlaylist = useCallback(async () => {
    console.log('🔵 [담기] handleSavePlaylist 호출됨');
    console.log('📊 [담기] 현재 상태:', {
      currentPlaylistId: currentPlaylist?.id,
      currentPlaylistTitle: currentPlaylist?.title,
      isOwner,
      isSaving,
      userId: user?.id,
      isAlreadySaved,
      userPlaylistsCount: userPlaylists?.length,
    });

    if (!currentPlaylist?.id || isOwner || isSaving) {
      console.log('⚠️ [담기] 조기 종료:', {
        noPlaylistId: !currentPlaylist?.id,
        isOwner,
        isSaving,
      });
      return;
    }
    
    if (!user?.id) {
      console.log('❌ [담기] 로그인 필요');
      Alert.alert('알림', '로그인 후에 플레이리스트를 담을 수 있어요.');
      return;
    }
    
    if (isAlreadySaved) {
      console.log('⚠️ [담기] 이미 담긴 플레이리스트');
      Alert.alert('알림', '이미 내 플레이리스트에 담았어요.');
      return;
    }

    console.log('🚀 [담기] API 호출 시작:', currentPlaylist.id);
    setIsSaving(true);
    
    try {
      console.log('📤 [담기] savePlaylistAsync 디스패치 중...');
      const saved = await dispatch(savePlaylistAsync(currentPlaylist.id)).unwrap();
      console.log('✅ [담기] savePlaylistAsync 성공:', saved);
      
      console.log('🔄 [담기] 플레이리스트 목록 새로고침 중...');
      await dispatch(fetchMyPlaylists());
      console.log('✅ [담기] 플레이리스트 목록 새로고침 완료');
      
      const savedTitle = currentPlaylist.title || saved?.title || '플레이리스트';
      console.log('🎉 [담기] 성공 메시지 표시:', savedTitle);
      Alert.alert('완료', `'${savedTitle}' 플레이리스트를 내 플레이리스트에 담았어요.`);
    } catch (error) {
      console.error('❌ [담기] 오류 발생:', error);
      console.error('❌ [담기] 오류 타입:', typeof error);
      console.error('❌ [담기] 오류 세부정보:', {
        message: error?.message,
        response: error?.response,
        responseData: error?.response?.data,
        responseStatus: error?.response?.status,
        stack: error?.stack,
        fullError: JSON.stringify(error, null, 2),
      });
      
      const message = typeof error === 'string' ? error : error?.message || '플레이리스트를 담는 중 오류가 발생했습니다.';
      console.log('📱 [담기] 오류 Alert 표시:', message);
      Alert.alert('오류', message);
    } finally {
      console.log('🔚 [담기] setIsSaving(false) 호출');
      setIsSaving(false);
    }
  }, [currentPlaylist, dispatch, isAlreadySaved, isOwner, isSaving, user?.id, userPlaylists]);

  const handleToggleLike = async () => {
    if (!currentPlaylist?.id) return;
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

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  if (status === 'loading' || !currentPlaylist) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        {toastVisible && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}
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
        {isOwner && (
          <TouchableOpacity style={styles.menuButton} onPress={() => {
            console.log('🎯 메뉴 버튼 클릭됨');
            setMenuVisible(true);
          }}>
            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
          </TouchableOpacity>
        )}

        {!isOwner && (
          <TouchableOpacity
            style={[
              styles.saveToLibraryButton,
              (isSaving || isAlreadySaved) && styles.saveToLibraryDisabled,
            ]}
            onPress={handleSavePlaylist}
            disabled={isSaving || isAlreadySaved}
          >
            <Ionicons
              name={isAlreadySaved ? 'checkmark-circle' : 'add-circle-outline'}
              size={20}
              color="#1DB954"
            />
            <Text style={styles.saveToLibraryText}>
              {isAlreadySaved ? '담김' : '담기'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.likeButton} onPress={handleToggleLike}>
          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#1DB954" : "white"} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity
            style={styles.playAllButton}
            onPress={handleAddSongs}
          >
            <Ionicons name="add" size={18} color="#121212" style={styles.playAllIcon} />
            <Text style={styles.playAllText}>노래추가</Text>
          </TouchableOpacity>
        )}
        
        {playableSongs.length > 0 && (
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

  const handleSongPress = (song) => {
    console.log('곡 선택됨:', song);
    handlePlayTrack(song);
  };

  const handleRemoveTrack = (song) => {
    console.log('곡 제거 버튼 클릭됨:', song);
    handleRemoveSong(song);
  };

  const handleHamburgerPress = (song) => {
    console.log('hamburger pressed:', song?.id);
  };

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
              onPress={() => handleSongPress(item)}
              onRemovePress={handleRemoveTrack}
              showRemoveButton
              showLikeButton
              onLikePress={handleToggleSongLike}
              liked={!!(likedSongsMap[item?.id] || likedSongsMap[item?.spotify_id])}
              showHamburgerButton
              onHamburgerPress={handleHamburgerPress}
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

      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteTitle}>플레이리스트를 삭제할까요?</Text>
            <Text style={styles.deleteMessage}>
              "{currentPlaylist?.title || '플레이리스트'}"을(를) 삭제하면 되돌릴 수 없어요.
            </Text>
            <View style={styles.deleteButtons}>
              <TouchableOpacity
                style={[styles.deleteButton, styles.deleteCancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.deleteCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, styles.deleteConfirmButton]}
                onPress={performPlaylistDeletion}
              >
                <Text style={styles.deleteConfirmText}>삭제</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toastVisible && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
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
    gap: 12,
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
  saveToLibraryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveToLibraryDisabled: {
    opacity: 0.6,
  },
  saveToLibraryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  likeButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  deleteTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  deleteMessage: {
    marginTop: 12,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
  },
  deleteButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
  },
  deleteButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  deleteCancelButton: {
    borderWidth: 1,
    borderColor: '#8B5CF6',
    backgroundColor: '#ffffff',
  },
  deleteCancelText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteConfirmButton: {
    backgroundColor: '#8B5CF6',
  },
  deleteConfirmText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PlaylistDetailScreen;
