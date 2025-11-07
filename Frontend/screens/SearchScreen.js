import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  SectionList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLikedSongs, toggleLikeSongThunk } from '../store/slices/likedSongsSlice';
import { useNavigation, useRoute } from '@react-navigation/native'; // ❗ useRoute 추가
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/apiService';
import SongListItem from '../components/SongListItem';
import debounce from 'lodash.debounce';
import { playTrack, loadQueue } from '../store/slices/playerSlice';
import { fetchMyPlaylists, createPlaylist } from '../store/slices/playlistSlice';
import { loadSearchHistory, addRecentSearch, removeRecentSearch, clearSearchHistory } from '../store/slices/searchSlice';
import { showToast } from '../utils/toast';

const placeholderImage = require('../assets/images/placeholder_album.png');

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
  const route = useRoute(); // ❗ useRoute 훅 사용

  const {
    isCreatingPlaylist,
    playlistTitle,
    playlistDescription,
    targetPlaylistId,
    targetPlaylistTitle,
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
  const [newlyCreatedPlaylistId, setNewlyCreatedPlaylistId] = useState(null); // ❗ 새로 추가
  const [isFinalizingPlaylist, setIsFinalizingPlaylist] = useState(false);
  const [likeInflight, setLikeInflight] = useState({});

  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  const isTrackOnlyMode = useMemo(
    () => Boolean(isCreatingPlaylist || targetPlaylistId),
    [isCreatingPlaylist, targetPlaylistId]
  );

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

  // 좋아요한 곡 화면은 Redux likedSongsSlice.list를 직접 사용합니다.

  const search = useCallback(async (searchQuery) => {
    if (!searchQuery) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      let trackResults = [];
      let playlistResults = [];

      if (isTrackOnlyMode) {
        trackResults = await apiService.searchTracks(searchQuery);
      } else {
        const [trackResponse, playlistResponse] = await Promise.all([
          apiService.searchTracks(searchQuery),
          apiService.searchPlaylists(searchQuery),
        ]);
        trackResults = trackResponse;
        playlistResults = playlistResponse;
      }

      const sections = [];

      if (!isTrackOnlyMode && playlistResults && playlistResults.length > 0) {
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
  }, [isTrackOnlyMode]);

  const debouncedSearch = useMemo(() => debounce(search, 500), [search]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleQueryChange = (text) => {
    setQuery(text);
    if (!text) {
      debouncedSearch.cancel();
      search(text);
    } else {
      debouncedSearch(text);
    }
  };

  const openPlaylistModal = async (song) => {
    setSelectedSong(song);
    setModalVisible(true);
    setSelectedPlaylistId(targetPlaylistId ?? null); // <-- 선택 초기화
  };

  const toggleShowLiked = () => {
    setShowLiked((v) => !v);
  };

  const handleSelectPlaylist = (playlistId) => {
    setSelectedPlaylistId(playlistId);
  };

  const handleConfirmAddSong = () => {
    if (selectedPlaylistId === null) {
      if (isCreatingPlaylist) {
        handleAddSongToPlaylist(null);
        return;
      }
      if (targetPlaylistId) {
        handleAddSongToPlaylist(targetPlaylistId);
        return;
      }
      Alert.alert('알림', '추가할 플레이리스트를 선택해주세요.');
      return;
    }

    handleAddSongToPlaylist(selectedPlaylistId);
  };

  const handleAddSongToPlaylist = async (playlistId) => {
    if (!selectedSong) return;

    let resolvedPlaylistId = playlistId ?? newlyCreatedPlaylistId;

    try {
      // ❗ 새 플레이리스트 생성 플로우
      if (isCreatingPlaylist && !newlyCreatedPlaylistId) {
        Alert.alert('플레이리스트 생성 중', '새 플레이리스트를 생성하고 곡을 추가합니다.');
        const newPlaylist = await dispatch(createPlaylist({
          title: playlistTitle,
          description: playlistDescription,
          is_public: true,
        })).unwrap(); // unwrap()을 사용하여 fulfilled 또는 rejected 값을 직접 가져옴
        resolvedPlaylistId = newPlaylist.id;
        setNewlyCreatedPlaylistId(newPlaylist.id); // 생성된 플레이리스트 ID 저장
        setSelectedPlaylistId(newPlaylist.id);
      }

      if (!resolvedPlaylistId) {
        Alert.alert('오류', '추가할 플레이리스트를 찾지 못했습니다.');
        return;
      }

      await apiService.addSongToPlaylist(resolvedPlaylistId, selectedSong);
      setModalVisible(false);
      const addedSongLabel = selectedSong.name || selectedSong.title || '곡';
      await showToast(`'${addedSongLabel}'을 플레이리스트에 추가했습니다.`, 1600);
      setSelectedSong(null);

      // 새 플레이리스트 생성 후 곡 추가가 완료되면 CreatePlaylistScreen으로 돌아가지 않고 SearchScreen에 머무름
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        (typeof error === 'string' ? error : error?.message) ||
        '곡 추가에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    }
  };

  const isAddDisabled =
    selectedPlaylistId === null && !isCreatingPlaylist && !targetPlaylistId;

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

    const targetId = track.spotify_id || track.id;
    const startIndex = queue.findIndex(item => (item.spotify_id || item.id) === targetId);
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
    const sections = [];

    if (!isTrackOnlyMode) {
      const playlists = history.filter((item) => item.type === 'playlist');
      if (playlists.length > 0) {
        sections.push({ title: '플레이리스트', data: playlists });
      }
    }

    const tracks = history.filter((item) => item.type === 'track');
    if (tracks.length > 0) {
      sections.push({ title: '음원', data: tracks });
    }

    return sections;
  }, [history, isTrackOnlyMode]);

  const handleRecentItemPress = (item) => {
    if (item.type === 'track') {
      handlePlayTrack(item.data);
    } else if (item.type === 'playlist') {
      if (isTrackOnlyMode) {
        return;
      }
      handlePlaylistPress(item.data);
    }
  };


  const renderRecentSearchItem = ({ item }) => {
    if (isTrackOnlyMode && item.type !== 'track') {
      return null;
    }

    return (
      <TouchableOpacity style={styles.recentItem} onPress={() => handleRecentItemPress(item)}>
        {item.type === 'track' && (
          <Ionicons
            name="musical-notes-outline"
            size={24}
            color="#b3b3b3"
            style={styles.recentIcon}
          />
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
  };

  const renderTrackListItem = (item) => {
    const trackKey = item.spotify_id || item.id || null;
    // 좋아요한 곡 목록에서는 무조건 liked=true, 검색 결과에서는 likedMapGlobal 확인
    const isLiked = showLiked ? true : (trackKey ? !!likedMapGlobal[trackKey] : false);

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
  const handleSavePlaylist = useCallback(async () => {
    if (!newlyCreatedPlaylistId) {
      Alert.alert('오류', '플레이리스트를 먼저 생성해주세요.');
      return;
    }

    if (isFinalizingPlaylist) {
      return;
    }

    setIsFinalizingPlaylist(true);

    let refreshSucceeded = false;

    try {
      await dispatch(fetchMyPlaylists()).unwrap();
      refreshSucceeded = true;
      await showToast('플레이리스트가 저장되었습니다.', 1800);
    } catch (error) {
      console.error('Failed to refresh playlists after save:', error);
      const message = error?.message || '플레이리스트 목록을 새로고침하지 못했습니다.';
      Alert.alert('오류', message);
    } finally {
      setIsFinalizingPlaylist(false);
      if (!refreshSucceeded) {
        return;
      }

      setModalVisible(false);
      setSelectedSong(null);
      setSelectedPlaylistId(null);
      const createdPlaylistId = newlyCreatedPlaylistId;
      setNewlyCreatedPlaylistId(null);
      setQuery(''); // 검색 창 초기화
      if (navigation.setParams) {
        navigation.setParams({
          isCreatingPlaylist: false,
          playlistTitle: undefined,
          playlistDescription: undefined,
        });
      }
      // 생성한 플레이리스트 상세 화면으로 이동하되, 뒤로가기 시 Home으로 복귀
      navigation.reset({
        index: 1,
        routes: [
          { name: 'Main', params: { screen: 'Home' } },
          { name: 'PlaylistDetail', params: { playlistId: createdPlaylistId } }
        ],
      });
    }
  }, [dispatch, newlyCreatedPlaylistId, navigation, isFinalizingPlaylist]);

  // Update header buttons: save button and liked toggle
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isCreatingPlaylist && newlyCreatedPlaylistId ? (
            <TouchableOpacity
              onPress={handleSavePlaylist}
              style={[styles.saveNavButton, isFinalizingPlaylist && styles.saveNavButtonDisabled]}
              disabled={isFinalizingPlaylist}
            >
              <Text style={styles.saveNavButtonText}>저장</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={toggleShowLiked} style={styles.likedToggleButton}>
            <Ionicons name={showLiked ? 'heart' : 'heart-outline'} size={20} color="#b04ad8ff" />
            <Text style={styles.likedToggleText}>{showLiked ? '좋아요' : '좋아요'}</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isCreatingPlaylist, newlyCreatedPlaylistId, showLiked, handleSavePlaylist, isFinalizingPlaylist]);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>음악 검색</Text>
          <View style={styles.headerActions}>
            {isCreatingPlaylist && newlyCreatedPlaylistId ? (
              <TouchableOpacity 
                style={[styles.saveButton, isFinalizingPlaylist && styles.saveButtonDisabled]} 
                onPress={handleSavePlaylist}
                disabled={isFinalizingPlaylist}
              >
                <Text style={styles.saveButtonText}>저장</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={toggleShowLiked} style={[styles.likedToggleButton, { marginLeft: 8 }]}>
              <Ionicons name={showLiked ? 'heart' : 'heart-outline'} size={18} color="#b04ad8ff" />
              <Text style={styles.likedToggleText}>좋아요한 곡</Text>
            </TouchableOpacity>
          </View>
        </View>
        {isCreatingPlaylist && (
          <View style={styles.playlistInfoBox}>
            <Text style={styles.playlistTitle}>
              '{playlistTitle || '새 플레이리스트'}' 생성 중...</Text>
            {newlyCreatedPlaylistId && (
              <Text style={styles.playlistSubtext}>곡을 추가한 후 저장 버튼을 눌러주세요</Text>
            )}
          </View>
        )}
        {!isCreatingPlaylist && targetPlaylistId && (
          <View style={styles.playlistInfoBox}>
            <Text style={styles.playlistTitle}>
              '{targetPlaylistTitle || '플레이리스트'}'에 곡을 추가하고 있어요
            </Text>
            <Text style={styles.playlistSubtext}>곡을 선택하고 추가 버튼을 눌러주세요</Text>
          </View>
        )}
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
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
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
                    if (isTrackOnlyMode) {
                      return null;
                    }
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
            <Text style={styles.emptyText}>
              {isTrackOnlyMode
                ? '추가할 곡을 검색해보세요.'
                : '다른 사용자의 플레이리스트를 검색해보세요.'}
            </Text>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setSelectedPlaylistId(null);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>플레이리스트에 추가</Text>

            {isCreatingPlaylist && (
              <TouchableOpacity
                style={[
                  styles.playlistItem,
                  selectedPlaylistId === null && styles.playlistItemSelected
                ]}
                onPress={() => handleSelectPlaylist(null)}
              >
                <View style={[styles.playlistItemImage, styles.newPlaylistIconContainer]}>
                  <Ionicons name="add" size={24} color="#fff" />
                </View>
                <View style={styles.playlistItemTextContainer}>
                  <Text style={styles.playlistTitle} numberOfLines={1}>
                    새 플레이리스트 '{playlistTitle || '새 플레이리스트'}'에 추가
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {playlistStatus === 'loading' ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <FlatList
                data={userPlaylists}
                keyExtractor={(item) => item.id.toString()}

                renderItem={({ item }) => {
                  const isSelected = selectedPlaylistId === item.id;

                  const coverImageSource = item.cover_images?.[0]
                    ? { uri: item.cover_images[0] }
                    : placeholderImage;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.playlistItem,
                        isSelected && styles.playlistItemSelected
                      ]}
                      onPress={() => handleSelectPlaylist(item.id)}
                    >
                      <Image
                        source={coverImageSource}
                        style={styles.playlistItemImage}
                        contentFit="cover"
                        transition={300}
                      />

                      <View style={styles.playlistItemTextContainer}>
                        <Text style={styles.playlistModalTitle} numberOfLines={1}>{item.title}</Text>
                      </View>

                     {isSelected && (
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={24}
                          color="#b04ad8ff"
                          style={styles.checkmarkIcon}
                        />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={() => (
                  !isCreatingPlaylist && <Text style={styles.emptyText}>생성된 플레이리스트가 없습니다.</Text>
                )}
              />
            )}

            <View style={styles.modalButtonRow}>
            {/* "추가" 버튼 */}
            <TouchableOpacity
              style={[
                styles.modalAddButton,
                isAddDisabled && styles.modalButtonDisabled
              ]}
              onPress={handleConfirmAddSong}
              disabled={isAddDisabled}
            >

              <Text style={styles.modalButtonText}>추가</Text>
            </TouchableOpacity>

            {/* "취소" 버튼 */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setModalVisible(false);
                setSelectedPlaylistId(null);
              }}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
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
    backgroundColor: '#b04ad8ff',
    marginRight: 8,
  },
  saveNavButtonDisabled: {
    opacity: 0.6,
  },
  saveNavButtonText: {
    color: '#121212',
    fontWeight: '800',
  },
  likedToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(159, 29, 185, 0.1)',
    borderColor: '#b04ad8ff',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  likedToggleText: {
    color: '#ffffffff',
    fontWeight: '700',
    marginLeft: 6,
  },
  playlistInfo: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  playlistInfoBox: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  playlistTitle: {
    color: '#b04ad8ff',
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
    backgroundColor: '#b04ad8ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    shadowColor: '#b04ad8ff',
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
    paddingVertical: 12,
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
    paddingVertical: 12,
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
    shadowOffset: { width: 0, height: -4 },
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playlistItemSelected: {
    backgroundColor: '#2a2a2a',
    borderColor: '#b04ad8ff',
  },
  playlistItemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  newPlaylistIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  playlistItemTextContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  playlistModalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  checkmarkIcon: {
    marginLeft: 10,
    marginRight: 5,
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  modalAddButton: {
    flex: 1,
    backgroundColor: '#b04ad8ff',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    marginRight: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalButtonDisabled: {
    backgroundColor: '#404040',
  },
  modalButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
   flex: 1,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 28,
    backgroundColor: '#404040',
    marginLeft: 5,
  },
  cancelButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchScreen;
