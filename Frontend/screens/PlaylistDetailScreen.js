import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert, Share } from 'react-native';
import { Image } from 'expo-image';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchPlaylistDetails, updatePlaylist, deletePlaylist, toggleLikePlaylist, createShareLinkAsync, fetchLikedPlaylists } from '../store/slices/playlistSlice';
import { playTrackWithPlaylist } from '../store/slices/playerSlice';
import { fetchLikedSongs, toggleLikeSongThunk } from '../store/slices/likedSongsSlice';
import { addRecentPlaylist } from '../store/slices/recentPlaylistsSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SongListItem from '../components/SongListItem';
import * as ApiService from '../services/apiService';
import { colors as palette, createStyles } from '../utils/ui';
import {
  buttonPrimary,
  card as cardStyle,
  iconButton as iconButtonStyle,
  modalOverlay as modalOverlayStyle,
  pressableHitSlop,
  textVariants,
} from '../utils/uiComponents';

const placeholderAlbum = require('../assets/images/placeholder_album.png');
const COVER_GRID_SIZE = 200;

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
  const dispatch = useAppDispatch();
  const { playlistId } = route.params;
  const { currentPlaylist, status, likedPlaylists } = useAppSelector((state) => state.playlist);
  const likedSongsMap = useAppSelector((state) => state.likedSongs.map || {});
  const { user } = useAppSelector((state) => state.auth);
  const spotify = useAppSelector((state) => state.spotify);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likeInflight, setLikeInflight] = useState({});

  const songs = currentPlaylist?.songs || [];

  const coverImages = useMemo(() => {
    if (!currentPlaylist) {
      return [];
    }
    if (Array.isArray(currentPlaylist.cover_images) && currentPlaylist.cover_images.length > 0) {
      return currentPlaylist.cover_images;
    }
    return songs
      .slice(0, 4)
      .map((song) => song?.album_cover_url)
      .filter(Boolean);
  }, [currentPlaylist, songs]);

  const primaryCoverImage = useMemo(() => {
    if (coverImages.length > 0) {
      return coverImages[0];
    }
    return currentPlaylist?.cover_image_url || null;
  }, [coverImages, currentPlaylist?.cover_image_url]);

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

  useEffect(() => {
    if (!currentPlaylist?.id) {
      return;
    }

    dispatch(addRecentPlaylist({
      id: currentPlaylist.id,
      title: currentPlaylist.title,
      description: currentPlaylist.description,
      cover_images: coverImages,
      cover_image_url: primaryCoverImage,
      user: currentPlaylist.user
        ? {
            id: currentPlaylist.user.id,
            display_name: currentPlaylist.user.display_name,
          }
        : null,
    }));
  }, [
    dispatch,
    currentPlaylist?.id,
    currentPlaylist?.title,
    currentPlaylist?.description,
    currentPlaylist?.user,
    coverImages,
    primaryCoverImage,
  ]);


  
  const handleEditPlaylist = () => {
    setMenuVisible(false);
    setEditModalVisible(true);
  };

  const handlePlayTrack = (song) => {
    if (!songs.length) {
      return;
    }
    dispatch(playTrackWithPlaylist({ track: song, playlist: songs }));
    navigation.navigate('Player');
  };

  const handlePlayAll = async () => {
    if (!songs.length) {
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
              playlist: songs,
            }
          }
        });
        return;
      }

      await dispatch(playTrackWithPlaylist({ playlist: songs }));
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
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  const renderHeader = () => (
    <LinearGradient colors={[palette.accentSecondary, palette.background]} style={styles.header}>
      <PlaylistHeaderImage songs={songs} />
      <Text style={styles.title}>{currentPlaylist.title}</Text>
      {currentPlaylist.description ? (
        <Text style={styles.description}>{currentPlaylist.description}</Text>
      ) : null}
      <Text style={styles.creator}>
        {`By ${currentPlaylist.user?.display_name || 'Unknown User'}`}
      </Text>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            console.log('🎯 메뉴 버튼 클릭됨');
            setMenuVisible(true);
          }}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={palette.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.likeButton, isLiked && styles.iconButtonActive]}
          onPress={handleToggleLike}
          hitSlop={pressableHitSlop}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={isLiked ? palette.accent : palette.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="share-outline" size={24} color={palette.textPrimary} />
        </TouchableOpacity>

        {songs.length > 0 && (
          <TouchableOpacity style={styles.playAllButton} onPress={handlePlayAll}>
            <Ionicons name="play" size={20} color={palette.background} />
            <Text style={styles.playAllText}>전체재생</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <View style={styles.fixedHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.fixedBackButton}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="arrow-back" size={24} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={songs}
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
            <Ionicons name="musical-notes-outline" size={48} color={palette.textMuted} />
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
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleEditPlaylist}
              hitSlop={pressableHitSlop}
            >
              <Ionicons name="create-outline" size={24} color={palette.textPrimary} />
              <Text style={styles.menuItemText}>플레이리스트 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.deleteMenuItem]}
              onPress={() => {
                console.log('🔴 삭제 메뉴 아이템 클릭됨');
                handleDeletePlaylist();
              }}
              hitSlop={pressableHitSlop}
            >
              <Ionicons name="trash-outline" size={24} color={palette.danger} />
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
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={pressableHitSlop}
              >
                <Ionicons name="close" size={24} color={palette.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.editForm}>
              <Text style={styles.inputLabel}>제목</Text>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="플레이리스트 제목을 입력하세요"
                placeholderTextColor={palette.textMuted}
              />
              
              <Text style={styles.inputLabel}>설명</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="플레이리스트 설명을 입력하세요"
                placeholderTextColor={palette.textMuted}
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

const styles = createStyles(({ colors, spacing, typography, radii, elevation }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: spacing.xxl * 2,
    zIndex: 100,
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  fixedBackButton: {
    ...iconButtonStyle({ size: 44 }),
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  playlistImageGrid: {
    width: COVER_GRID_SIZE,
    height: COVER_GRID_SIZE,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    ...elevation.overlay,
  },
  imageRow: {
    flexDirection: 'row',
    flex: 1,
  },
  gridImage: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  title: {
    ...typography.heading,
    fontSize: 30,
    textAlign: 'center',
  },
  description: {
    ...textVariants.subtitle,
    textAlign: 'center',
  },
  creator: {
    ...textVariants.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  menuButton: {
    ...iconButtonStyle({ size: 44 }),
  },
  likeButton: {
    ...iconButtonStyle({ size: 44 }),
  },
  shareButton: {
    ...iconButtonStyle({ size: 44 }),
  },
  iconButtonActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  playAllButton: {
    ...buttonPrimary({ pill: true }),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  playAllText: {
    ...typography.subheading,
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.subheading,
    textAlign: 'center',
  },
  emptySubtext: {
    ...textVariants.subtitle,
    textAlign: 'center',
  },
  modalOverlay: {
    ...modalOverlayStyle,
  },
  menuModal: {
    ...cardStyle({ padding: spacing.xs, muted: true, withBorder: false }),
    minWidth: 220,
    gap: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  deleteMenuItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  menuItemText: {
    ...textVariants.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  deleteMenuText: {
    color: colors.danger,
  },
  editModal: {
    ...cardStyle({ padding: 0, muted: true }),
    width: '90%',
    maxWidth: 420,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.lg,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  editTitle: {
    ...typography.subheading,
  },
  editForm: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  inputLabel: {
    ...textVariants.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minWidth: 96,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  saveButton: {
    backgroundColor: colors.accent,
  },
  cancelButtonText: {
    ...textVariants.subtitle,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  saveButtonText: {
    ...textVariants.subtitle,
    color: colors.background,
    fontWeight: '700',
  },
}));

export default PlaylistDetailScreen;
