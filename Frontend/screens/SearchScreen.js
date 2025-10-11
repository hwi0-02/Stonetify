import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, SectionList, FlatList, 
  TouchableOpacity, Modal, Alert, ActivityIndicator 
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';

import apiService from '../services/apiService';
import SongListItem from '../components/SongListItem';
import { playTrack } from '../store/slices/playerSlice';
import { addRecentSearch, clearSearchHistory, loadSearchHistory, removeRecentSearch } from '../store/slices/searchSlice';
import { createPlaylist, fetchMyPlaylists } from '../store/slices/playlistSlice'; // ❗ createPlaylist 추가

// 플레이리스트 검색 결과 아이템 컴포넌트
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
  const route = useRoute(); // ❗ route 훅 다시 추가

  // ❗ 새 플레이리스트 생성을 위한 파라미터 다시 추가
  const { isCreatingPlaylist, playlistTitle, playlistDescription } = route.params || {};
  
  const { history } = useSelector((state) => state.search);
  const { userPlaylists } = useSelector((state) => state.playlist);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  // ❗ 새로 생성된 플레이리스트 ID를 저장할 state 다시 추가
  const [newlyCreatedPlaylistId, setNewlyCreatedPlaylistId] = useState(null); 

  useEffect(() => {
    dispatch(loadSearchHistory());
  }, [dispatch]);

  const search = async (searchQuery) => {
    if (!searchQuery) { setResults([]); return; }
    setLoading(true);
    try {
      const [trackResults, playlistResults] = await Promise.all([
        apiService.searchTracks(searchQuery),
        apiService.searchPlaylists(searchQuery)
      ]);
      const sections = [];
      if (playlistResults && playlistResults.length > 0) {
        sections.push({ title: '플레이리스트', data: playlistResults.slice(0, 3).map(pl => ({ ...pl, type: 'playlist' })) });
      }
      if (trackResults && trackResults.length > 0) {
        sections.push({ title: '음원', data: trackResults.map(track => ({ ...track, type: 'track' })) });
      }
      setResults(sections);
    } catch (error) {
      console.error("검색 API 에러:", error);
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
    dispatch(fetchMyPlaylists());
    setSelectedSong(song);
    setModalVisible(true);
  };

  // ❗ [복구] 새 플레이리스트 생성 로직이 포함된 원래의 함수로 복구
  const handleAddSongToPlaylist = async (playlistId) => {
    if (!selectedSong) return;
    let targetPlaylistId = playlistId;
    try {
      // 새 플레이리스트 생성 플로우
      if (isCreatingPlaylist && !newlyCreatedPlaylistId && playlistId === null) {
        const newPlaylist = await dispatch(createPlaylist({
          title: playlistTitle,
          description: playlistDescription,
          is_public: true,
        })).unwrap();
        targetPlaylistId = newPlaylist.id;
        setNewlyCreatedPlaylistId(newPlaylist.id);
      }
      await apiService.addSongToPlaylist(targetPlaylistId, selectedSong);
      setModalVisible(false);
      Alert.alert('성공', '플레이리스트에 곡이 추가되었습니다.');
      setSelectedSong(null);
    } catch (error) {
      Alert.alert('오류', error.response?.data?.message || '곡 추가에 실패했습니다.');
    }
  };

  const handlePlayTrack = (track) => {
    dispatch(addRecentSearch({ type: 'track', data: track }));
    if (track.preview_url) {
      dispatch(playTrack(track));
      navigation.navigate('Player');
    } else {
      Alert.alert('미리듣기 없음', '이 곡은 미리듣기를 제공하지 않습니다.');
    }
  };

  const handlePlaylistPress = (playlist) => {
    dispatch(addRecentSearch({ type: 'playlist', data: playlist }));
    navigation.navigate('PlaylistDetail', { playlistId: playlist.id });
  };

  // ... 최근 검색 기록 관련 함수들은 그대로 유지 ...
  const recentSearchSections = useMemo(() => {
    const playlists = history.filter(item => item.type === 'playlist');
    const tracks = history.filter(item => item.type === 'track');
    const sections = [];
    if (playlists.length > 0) sections.push({ title: '플레이리스트', data: playlists });
    if (tracks.length > 0) sections.push({ title: '음원', data: tracks });
    return sections;
  }, [history]);
  const handleRecentItemPress = (item) => {
    if (item.type === 'track') { handlePlayTrack(item.data); }
    else if (item.type === 'playlist') { handlePlaylistPress(item.data); }
  };
  const renderRecentSearchItem = ({ item }) => (
    <TouchableOpacity style={styles.recentItem} onPress={() => handleRecentItemPress(item)}>
        {item.type === 'track' && <Ionicons name="musical-notes-outline" size={24} color="#b3b3b3" style={styles.recentIcon}/>}
        {item.type === 'playlist' && <Ionicons name="list-outline" size={24} color="#b3b3b3" style={styles.recentIcon}/>}
        <View style={styles.recentTextContainer}>
            <Text style={styles.recentText} numberOfLines={1}>{item.data?.title || item.data?.name || '알 수 없는 항목'}</Text>
            {item.type === 'track' && ( <Text style={styles.recentSubText} numberOfLines={1}> {item.data?.artists?.map(a => a.name).join(', ') || 'Unknown Artist'} </Text> )}
        </View>
        <TouchableOpacity onPress={() => dispatch(removeRecentSearch(item))} style={styles.removeRecentButton}><Ionicons name="close" size={22} color="#6a6a6a" /></TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* ... 헤더, 검색창 UI ... */}
      <View style={styles.header}><Text style={styles.headerTitle}>검색</Text></View>
      <View style={styles.searchContainer}><View style={styles.searchBar}><Ionicons name="search" size={18} color="#b3b3b3" style={styles.searchIcon} /><TextInput style={styles.input} placeholder="음악 또는 플레이리스트 검색" placeholderTextColor="#6a6a6a" value={query} onChangeText={handleQueryChange} autoFocus={true} />{query.length > 0 && (<TouchableOpacity onPress={() => { setQuery(''); setResults([]); }} style={styles.clearButton}><Ionicons name="close-circle" size={18} color="#6a6a6a" /></TouchableOpacity>)}</View></View>
      
      <View style={styles.contentContainer}>
        {query.length > 0 ? (
          loading ? <ActivityIndicator/> : <SectionList sections={results} keyExtractor={(item) => (item.id || item.spotify_id).toString()} renderItem={({ item }) => { if (item.type === 'track') { return <SongListItem item={item} onPress={handlePlayTrack} onAddPress={openPlaylistModal} />; } if (item.type === 'playlist') { return <PlaylistListItem item={item} onPress={handlePlaylistPress} />; } return null; }} renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>} ListEmptyComponent={() => <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>} />
        ) : (
          history.length > 0 ? <SectionList sections={recentSearchSections} keyExtractor={(item, index) => (item.data?.id || item.data?.spotify_id || index).toString()} renderItem={renderRecentSearchItem} renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>} ListHeaderComponent={() => ( <View style={styles.recentHeader}><Text style={styles.recentHeaderText}>최근 검색</Text><TouchableOpacity onPress={() => dispatch(clearSearchHistory())}><Text style={styles.clearAllText}>전체 삭제</Text></TouchableOpacity></View> )} /> : <Text style={styles.emptyText}>다른 사용자의 플레이리스트를 검색해보세요.</Text>
        )}
      </View>

      {/* ❗ [복구] 새 플레이리스트 생성 옵션이 포함된 모달로 복구 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>플레이리스트에 추가</Text>
            {/* 새 플레이리스트 생성 중일 때 표시되는 옵션 */}
            {isCreatingPlaylist && (
              <TouchableOpacity 
                style={styles.modalPlaylistItem}
                onPress={() => handleAddSongToPlaylist(null)} // null을 전달하여 새 플레이리스트 생성 로직 실행
              >
                <Text style={styles.modalPlaylistTitle}>새 플레이리스트 '{playlistTitle}'에 추가</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={userPlaylists}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalPlaylistItem} onPress={() => handleAddSongToPlaylist(item.id)}>
                  <Text style={styles.modalPlaylistTitle}>{item.title}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => !isCreatingPlaylist && <Text style={styles.emptyText}>생성된 플레이리스트가 없습니다.</Text>}
            />
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
  container: { flex: 1, backgroundColor: '#121212' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  searchIcon: { marginRight: 12 },
  input: { flex: 1, color: '#ffffff', fontSize: 16 },
  clearButton: { padding: 4 },
  contentContainer: { flex: 1 },
  emptyText: { color: '#6a6a6a', textAlign: 'center', marginTop: 60, fontSize: 16 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, marginTop: 10 },
  recentHeaderText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  clearAllText: { color: '#b3b3b3', fontSize: 14 },
  sectionHeader: { color: '#ffffff', fontSize: 18, fontWeight: 'bold', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: '#121212' },
  recentItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  recentIcon: { marginRight: 15 },
  recentTextContainer: { flex: 1 },
  recentText: { color: '#ffffff', fontSize: 16 },
  recentSubText: { color: '#b3b3b3', fontSize: 14, marginTop: 2 },
  removeRecentButton: { padding: 5 },
  playlistItemContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8 },
  playlistIcon: { marginRight: 10 },
  playlistTextContainer: { flex: 1 },
  playlistItemTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  playlistItemOwner: { color: '#b3b3b3', fontSize: 14, marginTop: 4 },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#282828', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '60%' },
  modalTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  modalPlaylistItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#404040' },
  modalPlaylistTitle: { color: '#ffffff', fontSize: 16 },
  cancelButton: { backgroundColor: '#404040', borderRadius: 24, paddingVertical: 14, marginTop: 20 },
  cancelButtonText: { color: '#ffffff', textAlign: 'center', fontWeight: 'bold' },
});

export default SearchScreen;