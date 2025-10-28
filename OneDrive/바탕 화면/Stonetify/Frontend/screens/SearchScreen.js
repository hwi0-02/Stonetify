import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, SectionList, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLikedSongs, toggleLikeSongThunk } from '../store/slices/likedSongsSlice';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/apiService';
import SongListItem from '../components/SongListItem';
import debounce from 'lodash.debounce';
import { playTrack, loadQueue } from '../store/slices/playerSlice';
import { fetchMyPlaylists, createPlaylist, fetchPlaylistDetails, addSongToPlaylistThunk } from '../store/slices/playlistSlice';
import { loadSearchHistory, addRecentSearch, removeRecentSearch, clearSearchHistory } from '../store/slices/searchSlice';

const PlaylistListItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.playlistItemContainer} onPress={() => onPress(item)}>
    <Ionicons name="list-circle-outline" size={48} color="#b3b3b3" style={styles.playlistIcon} />
    <View style={styles.playlistTextContainer}>
      <Text style={styles.playlistItemTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.playlistItemOwner} numberOfLines={1}>
        플레이리스트 • {item.owner_nickname || '사용자'}
      </Text>
    </View>
  </TouchableOpacity>
);

const SearchScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const { targetPlaylistId, targetPlaylistTitle } = route.params || {};

  const {
    isCreatingPlaylist,
    playlistTitle,
    playlistDescription,
    newlyCreatedPlaylistId,
  } = route.params || {}; // ❗ 파라미터 가져오기

  const { userPlaylists, status: playlistStatus } = useSelector((state) => state.playlist);
  const { history } = useSelector((state) => state.search);
  const userId = useSelector((state) => state.auth.user?.id);
  const spotifyState = useSelector((state) => state.spotify);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLiked, setShowLiked] = useState(false);
  const likedMapGlobal = useSelector(state => state.likedSongs.map);
  const likedSongsList = useSelector(state => state.likedSongs.list);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [likeInflight, setLikeInflight] = useState({});
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);

  const canPlayFullTracks = useMemo(() => {
    const hasToken = !!spotifyState?.accessToken;
    const isPremium = !!spotifyState?.isPremium;
    return hasToken && isPremium;
  }, [spotifyState?.accessToken, spotifyState?.isPremium]);

  const trackResults = useMemo(() => {
    const trackSection = results.find((section) => section.title === '음원');
    return trackSection ? trackSection.data : [];
  }, [results]);

  useEffect(() => {
    dispatch(fetchMyPlaylists());
    dispatch(fetchLikedSongs());
  }, [dispatch, userId]);

  useEffect(() => {
    dispatch(loadSearchHistory());
  }, [dispatch, userId]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // 좋아요한 곡 화면은 Redux likedSongsSlice.list를 직접 사용합니다.

  const search = async (searchQuery) => {
    if (!searchQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const [trackResults, playlistResults] = await Promise.all([
        apiService.searchTracks(searchQuery),
        apiService.searchPlaylists(searchQuery),
      ]);

      const sections = [];

      if (playlistResults && playlistResults.length > 0) {
        sections.push({
          title: '플레이리스트',
          data: playlistResults.slice(0, 3).map((playlist) => ({
            ...playlist,
            type: 'playlist',
          })),
        });
      }

      if (trackResults && trackResults.length > 0) {
        sections.push({
          title: '음원',
          data: trackResults.map((track) => ({
            ...track,
            type: 'track',
          })),
        });
      }

      setResults(sections);
    } catch (error) {
      Alert.alert('오류', '검색 결과를 불러오는데 실패했습니다.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(search, 500), []);

  const handleQueryChange = (text) => {
    setQuery(text);
    debouncedSearch(text);
  };

  const openPlaylistModal = (song) => {
    if (!song) {
      return;
    }

    if (targetPlaylistId) {
      handleAddSongToPlaylist(targetPlaylistId, song);
      return;
    }

    setSelectedSong(song);
    setModalVisible(true);
  };

  const toggleShowLiked = () => {
    setShowLiked((v) => !v);
  };

  const handleAddSongToPlaylist = async (playlistId, songOverride = null) => {
    const songToAdd = songOverride || selectedSong;
    if (!songToAdd) return;

    let destinationPlaylistId = playlistId;

    try {
      if (isCreatingPlaylist && !newlyCreatedPlaylistId) {
        Alert.alert('플레이리스트 생성 중', '새 플레이리스트를 생성하고 곡을 추가합니다.');
        const newPlaylist = await dispatch(createPlaylist({
          title: playlistTitle,
          description: playlistDescription,
          is_public: true,
        })).unwrap();
        destinationPlaylistId = newPlaylist.id;
      }

      await dispatch(
        addSongToPlaylistThunk({
          playlistId: destinationPlaylistId,
          songData: songToAdd,
        })
      ).unwrap();

      setModalVisible(false);
      setSelectedSong(null);
      showToast('플레이리스트에 추가되었습니다.');

      await dispatch(fetchMyPlaylists());
      if (targetPlaylistId && destinationPlaylistId === targetPlaylistId) {
        await dispatch(fetchPlaylistDetails(targetPlaylistId));
      }
    } catch (error) {
      const status = error?.status;
      const errorMessage = error?.message || '곡 추가에 실패했습니다.';
      const isDuplicate =
        status === 409 ||
        /이미/.test(errorMessage) ||
        /already/i.test(errorMessage) ||
        /duplicate/i.test(errorMessage);

      if (isDuplicate) {
        setModalVisible(false);
        setSelectedSong(null);
        showToast('이미 추가한 곡입니다.');
        if (targetPlaylistId) {
          await dispatch(fetchPlaylistDetails(targetPlaylistId));
        }
        return;
      }

      Alert.alert('오류', errorMessage);
    }
  };

  const handlePlayTrack = (track) => {
    if (!canPlayFullTracks) {
      Alert.alert(
        'Spotify 연결 필요',
        '프로필 화면에서 Spotify 계정을 연결하면 전체 트랙을 재생할 수 있습니다.'
      );
      return;
    }
    const rawList = showLiked ? likedSongsList : trackResults;
    if (!rawList || !rawList.length) return;

    const queue = rawList
      .map((candidate) => ({
        id: candidate.spotify_id || candidate.id,
        spotify_id: candidate.spotify_id || candidate.id,
        name: candidate.name || candidate.title,
        title: candidate.title || candidate.name,
        artists: candidate.artists,
        album: candidate.album,
        album_cover_url: candidate.album_cover_url,
        uri: candidate.uri,
        preview_url: candidate.preview_url,
      }))
      .filter((candidate) => !!(candidate.spotify_id || candidate.id));

    if (!queue.length) {
      Alert.alert('재생 오류', '재생 가능한 트랙이 없습니다.');
      return;
    }

    const startIndex = list.findIndex(t => (t.id || t.spotify_id) === (track.id || track.spotify_id));
    if (startIndex === -1) return;
    if (!showLiked) {
      dispatch(addRecentSearch({ type: 'track', data: track }));
    }
    dispatch(loadQueue({ tracks: queue, startIndex }))
      .unwrap()
    .then(() => navigation.navigate('Player'))
      .catch(() => Alert.alert('재생 오류', '재생 가능한 트랙이 없습니다.'));
  };

  const handlePlaylistPress = (playlist) => {
    dispatch(addRecentSearch({ type: 'playlist', data: playlist }));
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  };

  const recentSearchSections = useMemo(() => {
    const playlists = history.filter((item) => item.type === 'playlist');
    const tracks = history.filter((item) => item.type === 'track');
    const sections = [];

    if (playlists.length > 0) {
      sections.push({ title: '플레이리스트', data: playlists });
    }

    if (tracks.length > 0) {
      sections.push({ title: '음원', data: tracks });
    }

    return sections;
  }, [history]);

  const handleRecentItemPress = (item) => {
    if (item.type === 'track') {
      handlePlayTrack(item.data);
    } else if (item.type === 'playlist') {
      handlePlaylistPress(item.data);
    }
  };

  const renderRecentSearchItem = ({ item }) => (
    <TouchableOpacity style={styles.recentItem} onPress={() => handleRecentItemPress(item)}>
      {item.type === 'track' && (
        <Ionicons name="musical-notes-outline" size={24} color="#b3b3b3" style={styles.recentIcon} />
      )}
      {item.type === 'playlist' && (
        <Ionicons name="list-outline" size={24} color="#b3b3b3" style={styles.recentIcon} />
      )}
      <View style={styles.recentTextContainer}>
        <Text style={styles.recentText} numberOfLines={1}>
          {item.data?.title || item.data?.name || '알 수 없는 항목'}
        </Text>
        {item.type === 'track' && (
          <Text style={styles.recentSubText} numberOfLines={1}>
            {item.data?.artists?.map((artist) => artist.name).join(', ') || 'Unknown Artist'}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => dispatch(removeRecentSearch(item))}
        style={styles.removeRecentButton}
      >
        <Ionicons name="close" size={22} color="#6a6a6a" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderTrackListItem = (item) => {
    const trackKey = item.spotify_id || item.id || null;
    const isLiked = trackKey ? !!likedMapGlobal[trackKey] : false;

    return (
      <SongListItem
        item={item}
        onPress={canPlayFullTracks ? handlePlayTrack : undefined}
        onAddPress={openPlaylistModal}
        showLikeButton
        liked={isLiked}
        showPlayButton={canPlayFullTracks}
        onPlayPress={handlePlayTrack}
        onLikePress={async (song) => {
          const sKey = song.spotify_id || song.id || null;
          if (!sKey) {
            Alert.alert('오류', '이 곡에는 유효한 식별자가 없어 좋아요를 처리할 수 없습니다.');
            return;
          }
          if (likeInflight[sKey]) return;
          setLikeInflight((prev) => ({ ...prev, [sKey]: true }));
          try {
            await dispatch(toggleLikeSongThunk({ ...song, id: song.id, spotify_id: song.spotify_id })).unwrap();
          } catch (e) {
            Alert.alert('오류', '좋아요 처리에 실패했습니다.');
          } finally {
            setLikeInflight((prev) => {
              const next = { ...prev };
              delete next[sKey];
              return next;
            });
          }
        }}
      />
    );
  };

  // 플레이리스트 생성 완료 함수
  const handleSavePlaylist = () => {
    if (newlyCreatedPlaylistId) {
      // 저장 후 목록 새로고침
      dispatch(fetchMyPlaylists());
      // 생성 모드 해제 및 상태 정리
      setModalVisible(false);
      setSelectedSong(null);
      // Search 화면을 기본 상태로 전환 (params 제거)
      if (navigation.setParams) {
        navigation.setParams({
          isCreatingPlaylist: false,
          playlistTitle: undefined,
          playlistDescription: undefined,
        });
      }
      // Search 탭으로 명시적 이동 (기본 검색 화면)
      navigation.navigate('Main', { screen: 'Search' });
    } else {
      Alert.alert('오류', '플레이리스트를 먼저 생성해주세요.');
    }
  };

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
      toastTimerRef.current = null;
    }, 2000);
  }, []);

  // Update header buttons: save button and liked toggle
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isCreatingPlaylist && newlyCreatedPlaylistId ? (
            <TouchableOpacity onPress={handleSavePlaylist} style={styles.saveNavButton}>
              <Text style={styles.saveNavButtonText}>저장</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={toggleShowLiked} style={styles.likedToggleButton}>
            <Ionicons name={showLiked ? 'heart' : 'heart-outline'} size={20} color="#1DB954" />
            <Text style={styles.likedToggleText}>{showLiked ? '좋아요' : '좋아요'}</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isCreatingPlaylist, newlyCreatedPlaylistId, showLiked]);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>음악 검색</Text>
          <View style={styles.headerActions}>
            {isCreatingPlaylist && newlyCreatedPlaylistId ? (
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSavePlaylist}
              >
                <Text style={styles.saveButtonText}>저장</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={toggleShowLiked} style={[styles.likedToggleButton, { marginLeft: 8 }]}>
              <Ionicons name={showLiked ? 'heart' : 'heart-outline'} size={18} color="#1DB954" />
              <Text style={styles.likedToggleText}>좋아요한 곡</Text>
            </TouchableOpacity>
          </View>
        </View>
        {isCreatingPlaylist ? (
          <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle}>'{playlistTitle}' 생성 중...</Text>
            {newlyCreatedPlaylistId && (
              <Text style={styles.playlistSubtext}>곡을 추가한 후 저장 버튼을 눌러주세요</Text>
            )}
          </View>
        ) : targetPlaylistId ? (
          <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle}>
              '{targetPlaylistTitle || '선택한 플레이리스트'}'에 곡 추가 중...
            </Text>
            <Text style={styles.playlistSubtext}>곡을 선택하면 자동으로 추가됩니다.</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#b3b3b3" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="좋아하는 곡, 아티스트, 앨범을 검색해보세요"
            placeholderTextColor="#6a6a6a"
            value={query}
            onChangeText={handleQueryChange}
            autoFocus={true}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color="#6a6a6a" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {showLiked ? (
        <FlatList
          data={likedSongsList}
          keyExtractor={(item, idx) => (item.id || item.spotify_id || idx).toString()}
          renderItem={({ item }) => renderTrackListItem(item)}
          ListEmptyComponent={() => (
            !loading && <Text style={styles.emptyText}>좋아요한 곡이 없습니다.</Text>
          )}
        />
      ) : (
        <View style={styles.searchResultsContainer}>
          {query.length > 0 ? (
            loading ? (
              <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#fff" />
            ) : (
              <SectionList
                sections={results}
                keyExtractor={(item, index) => `${item.type || 'track'}-${item.id || item.spotify_id || index}`}
                renderItem={({ item }) => {
                  if (item.type === 'playlist') {
                    return <PlaylistListItem item={item} onPress={handlePlaylistPress} />;
                  }
                  return renderTrackListItem(item);
                }}
                renderSectionHeader={({ section: { title } }) => (
                  <Text style={styles.sectionHeader}>{title}</Text>
                )}
                ListEmptyComponent={() => (
                  <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                )}
              />
            )
          ) : history.length > 0 ? (
            <SectionList
              sections={recentSearchSections}
              keyExtractor={(item, index) => `${item.type}-${item.data?.id || item.data?.spotify_id || index}`}
              renderItem={renderRecentSearchItem}
              renderSectionHeader={({ section: { title } }) => (
                <Text style={styles.sectionHeader}>{title}</Text>
              )}
              ListHeaderComponent={() => (
                <View style={styles.recentHeader}>
                  <Text style={styles.recentHeaderText}>최근 검색</Text>
                  <TouchableOpacity onPress={() => dispatch(clearSearchHistory())}>
                    <Text style={styles.clearAllText}>전체 삭제</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={() => (
                <Text style={styles.emptyText}>최근 검색 기록이 없습니다.</Text>
              )}
            />
          ) : (
            <Text style={styles.emptyText}>다른 사용자의 플레이리스트를 검색해보세요.</Text>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>플레이리스트에 추가</Text>
            {isCreatingPlaylist && (
              <TouchableOpacity 
                style={styles.playlistItem}
                onPress={() => handleAddSongToPlaylist(null)} // null을 전달하여 새 플레이리스트 생성 로직 트리거
              >
                <Text style={styles.playlistTitle}>새 플레이리스트 '{playlistTitle}'에 추가</Text>
              </TouchableOpacity>
            )}
            {playlistStatus === 'loading' ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <FlatList
                data={userPlaylists} 
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.playlistItem} onPress={() => handleAddSongToPlaylist(item.id)}>
                    <Text style={styles.playlistTitle}>{item.title}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  !isCreatingPlaylist && <Text style={styles.emptyText}>생성된 플레이리스트가 없습니다.</Text>
                )}
              />
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {toastVisible && !!toastMessage && (
        <View style={styles.toastWrapper} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212' 
  },
  header: { 
    paddingTop: 60, 
    paddingBottom: 20, 
    paddingHorizontal: 20,
    backgroundColor: '#121212',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { 
    color: '#ffffff', 
    fontSize: 28, 
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  saveNavButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1DB954',
    marginRight: 8,
  },
  saveNavButtonText: {
    color: '#121212',
    fontWeight: '800',
  },
  likedToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29,185,84,0.1)',
    borderColor: '#1DB954',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  likedToggleText: {
    color: '#1DB954',
    fontWeight: '700',
    marginLeft: 6,
  },
  playlistInfo: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  playlistTitle: {
    color: '#1db954',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playlistSubtext: {
    color: '#6a6a6a',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1db954',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#1db954',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#404040',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Header navigation save button styles
  saveNavButton: {
    marginRight: 16,
    padding: 8,
  },
  saveNavButtonText: {
    color: '#1db954',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#2a2a2a', 
    borderRadius: 24, 
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: { 
    marginRight: 12 
  },
  clearButton: {
    padding: 4,
  },
  input: { 
    flex: 1, 
    height: 24, 
    color: '#ffffff', 
    fontSize: 16,
    fontWeight: '500',
  },
  searchResultsContainer: {
    flex: 1,
  },
  sectionHeader: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#121212',
  },
  playlistItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  playlistIcon: {
    marginRight: 12,
  },
  playlistTextContainer: {
    flex: 1,
  },
  playlistItemTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  playlistItemOwner: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 4,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 12,
  },
  recentHeaderText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearAllText: {
    color: '#b3b3b3',
    fontSize: 14,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  recentIcon: {
    marginRight: 15,
  },
  recentTextContainer: {
    flex: 1,
  },
  recentText: {
    color: '#ffffff',
    fontSize: 16,
  },
  recentSubText: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 2,
  },
  removeRecentButton: {
    padding: 5,
  },
  emptyText: { 
    color: '#6a6a6a', 
    textAlign: 'center', 
    marginTop: 60,
    fontSize: 16,
    fontWeight: '500',
  },
  // Modal Styles
  modalContainer: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.8)' 
  },
  modalContent: { 
    backgroundColor: '#1a1a1a', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24, 
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  modalTitle: { 
    color: '#ffffff', 
    fontSize: 22, 
    fontWeight: '700', 
    marginBottom: 24, 
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  playlistItem: { 
    paddingVertical: 16, 
    paddingHorizontal: 16,
    borderBottomWidth: 1, 
    borderBottomColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#282828',
  },
  playlistTitle: { 
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: '600',
  },
  cancelButton: { 
    marginTop: 24, 
    paddingVertical: 14, 
    borderRadius: 28, 
    backgroundColor: '#404040',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cancelButtonText: { 
    color: '#ffffff', 
    textAlign: 'center', 
    fontSize: 16,
    fontWeight: '600',
  },
  toastWrapper: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchScreen;
