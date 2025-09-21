import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLikedSongs, toggleLikeSongThunk, toggleLocal as toggleLikedLocal } from '../store/slices/likedSongsSlice';
import { useNavigation, useRoute } from '@react-navigation/native'; // ❗ useRoute 추가
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/apiService';
import SongListItem from '../components/SongListItem';
import debounce from 'lodash.debounce';
import { playTrack } from '../store/slices/playerSlice';
import { fetchMyPlaylists, createPlaylist } from '../store/slices/playlistSlice';
import { loadSearchHistory, saveSearchTerm, addRecentSearch } from '../store/slices/searchSlice';

const SearchScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute(); // ❗ useRoute 훅 사용

  const { isCreatingPlaylist, playlistTitle, playlistDescription } = route.params || {}; // ❗ 파라미터 가져오기

  const { userPlaylists, status: playlistStatus } = useSelector((state) => state.playlist);
  const { history, popularSearches } = useSelector((state) => state.search);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLiked, setShowLiked] = useState(false);
  const [likedSongs, setLikedSongs] = useState([]);
  const likedMapGlobal = useSelector(state => state.likedSongs.map);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [newlyCreatedPlaylistId, setNewlyCreatedPlaylistId] = useState(null); // ❗ 새로 추가

  useEffect(() => {
    dispatch(fetchMyPlaylists());
    dispatch(loadSearchHistory());
    dispatch(fetchLikedSongs());
  }, [dispatch]);

  useEffect(() => {
    if (showLiked) {
      (async () => {
        try {
          setLoading(true);
          const data = await apiService.getMyLikedSongs();
          setLikedSongs(Array.isArray(data) ? data : []);
          // 글로벌 likedSongs는 slice에서 관리되므로 화면용 목록만 유지
        } catch (e) {
          Alert.alert('오류', '좋아요한 곡을 불러오는데 실패했습니다.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [showLiked]);

  const search = async (searchQuery) => {
    if (!searchQuery) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiService.searchTracks(searchQuery);
      setResults(data);
    } catch (error) {
      Alert.alert('오류', '검색 결과를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(search, 500), []);

  const handleQueryChange = (text) => {
    setQuery(text);
    debouncedSearch(text);
  };

  const openPlaylistModal = async (song) => {
    setSelectedSong(song);
    setModalVisible(true);
  };

  const toggleShowLiked = () => {
    setShowLiked((v) => !v);
  };

  const handleAddSongToPlaylist = async (playlistId) => {
    if (!selectedSong) return;

    let targetPlaylistId = playlistId;

    try {
      // ❗ 새 플레이리스트 생성 플로우
      if (isCreatingPlaylist && !newlyCreatedPlaylistId) {
        Alert.alert('플레이리스트 생성 중', '새 플레이리스트를 생성하고 곡을 추가합니다.');
        const newPlaylist = await dispatch(createPlaylist({
          title: playlistTitle,
          description: playlistDescription,
          is_public: true,
        })).unwrap(); // unwrap()을 사용하여 fulfilled 또는 rejected 값을 직접 가져옴
        targetPlaylistId = newPlaylist.id;
        setNewlyCreatedPlaylistId(newPlaylist.id); // 생성된 플레이리스트 ID 저장
      }

      await apiService.addSongToPlaylist(targetPlaylistId, selectedSong);
      dispatch(fetchMyPlaylists()); // ❗ 추가: 플레이리스트 목록 새로고침
      setModalVisible(false);
      Alert.alert('성공', `'${selectedSong.name}' 곡이 플레이리스트에 추가되었습니다.`);
      setSelectedSong(null);

      // 새 플레이리스트 생성 후 곡 추가가 완료되면 CreatePlaylistScreen으로 돌아가지 않고 SearchScreen에 머무름
    } catch (error) {
      const errorMessage = error.response?.data?.message || '곡 추가에 실패했습니다.';
      Alert.alert('오류', errorMessage);
    }
  };

  const handlePlayTrack = (track) => {
    if (track.preview_url) {
      dispatch(playTrack(track));
      navigation.navigate('Player');
    } else {
      Alert.alert('미리듣기 없음', '이 곡은 미리듣기를 제공하지 않습니다.');
    }
  };

  // 플레이리스트 생성 완료 함수
  const handleSavePlaylist = () => {
    if (newlyCreatedPlaylistId) {
  // 완료 후 메인으로 이동 및 플레이리스트 새로고침
  dispatch(fetchMyPlaylists());
  // AppNavigator 구조 상 Stack: 'Main' 안에 Tab: 'Home'/'Search'/'Profile'
  navigation.navigate('Main', { screen: 'Home' });
    } else {
      Alert.alert('오류', '플레이리스트를 먼저 생성해주세요.');
    }
  };

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
        {isCreatingPlaylist && (
          <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle}>'{playlistTitle}' 생성 중...</Text>
            {newlyCreatedPlaylistId && (
              <Text style={styles.playlistSubtext}>곡을 추가한 후 저장 버튼을 눌러주세요</Text>
            )}
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

      {loading && (showLiked ? likedSongs.length === 0 : results.length === 0) ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#fff" />
      ) : (
        <FlatList
          data={showLiked ? likedSongs : results}
          keyExtractor={(item, idx) => (item.id || item.spotify_id || idx).toString()}
          renderItem={({ item }) => {
            const trackKey = item.spotify_id || item.id || null;
            const isLiked = trackKey ? !!likedMapGlobal[trackKey] : false;
            return (
              <SongListItem 
                item={item} 
                onPress={handlePlayTrack} 
                onAddPress={openPlaylistModal} 
                showLikeButton
                liked={isLiked}
                onLikePress={async (song) => {
                  const sKey = song.spotify_id || song.id || null;
                  if (!sKey) {
                    Alert.alert('오류', '이 곡에는 유효한 식별자가 없어 좋아요를 처리할 수 없습니다.');
                    return;
                  }
                  const curr = !!likedMapGlobal[sKey];
                  // optimistic local: dispatch local toggle to update global map/list
                  dispatch(toggleLikedLocal({ ...song, id: song.id, spotify_id: song.spotify_id }));
                  try {
                    await dispatch(toggleLikeSongThunk({ ...song, id: song.id, spotify_id: song.spotify_id })).unwrap();
                    if (showLiked && curr) {
                      // removing from liked list
                      setLikedSongs((list) => list.filter(s => (s.id || s.spotify_id) !== sKey));
                    } else if (showLiked && !curr) {
                      // adding to liked list from liked view (rare), append
                      setLikedSongs((list) => [{ ...song, liked_at: Date.now() }, ...list]);
                    }
                  } catch (e) {
                    // rollback: toggle back
                    dispatch(toggleLikedLocal({ ...song, id: song.id, spotify_id: song.spotify_id }));
                    Alert.alert('오류', '좋아요 처리에 실패했습니다.');
                  }
                }}
              />
            );
          }}
          ListEmptyComponent={() => (
            !loading && (
              showLiked
                ? <Text style={styles.emptyText}>좋아요한 곡이 없습니다.</Text>
                : (query.length > 0 && <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>)
            )
          )}
        />
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
});

export default SearchScreen;