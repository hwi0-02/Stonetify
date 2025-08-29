import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native'; // ❗ useRoute 추가
import { Ionicons } from '@expo/vector-icons';
import apiService from '../services/apiService';
import SongListItem from '../components/SongListItem';
import { debounce } from 'lodash';
import { playTrack } from '../store/slices/playerSlice';
import { fetchMyPlaylists, createPlaylist } from '../store/slices/playlistSlice'; // ❗ createPlaylist 추가

const SearchScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute(); // ❗ useRoute 훅 사용

  const { isCreatingPlaylist, playlistTitle, playlistDescription } = route.params || {}; // ❗ 파라미터 가져오기

  const { userPlaylists, status: playlistStatus } = useSelector((state) => state.playlist);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [newlyCreatedPlaylistId, setNewlyCreatedPlaylistId] = useState(null); // ❗ 새로 추가

  useEffect(() => {
    dispatch(fetchMyPlaylists());
  }, [dispatch]);

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
      if (isCreatingPlaylist) {
        navigation.setParams({ isCreatingPlaylist: false }); // 플래그 초기화
      }

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>음악 검색</Text>
        {isCreatingPlaylist && (
          <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle}>{playlistTitle}</Text>
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

      {loading && results.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#fff" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SongListItem 
              item={item} 
              onPress={handlePlayTrack} 
              onAddPress={openPlaylistModal} 
            />
          )}
          ListEmptyComponent={() => (
            !loading && query.length > 0 && <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
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
  headerTitle: { 
    color: '#ffffff', 
    fontSize: 28, 
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 8,
  },
  playlistInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  playlistTitle: {
    color: '#1DB954',
    fontSize: 12,
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