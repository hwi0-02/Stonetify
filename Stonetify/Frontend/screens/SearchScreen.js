import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, FlatList, Text, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { searchTracks, clearSearchResults } from '../store/slices/spotifySlice';
import { createPlaylist } from '../store/slices/playlistSlice'; // createPlaylist thunk 추가
import { Ionicons } from '@expo/vector-icons';
import SongListItem from '../components/SongListItem';

const SearchScreen = ({ route, navigation }) => {
  const { isCreatingPlaylist, playlistTitle, playlistDescription } = route.params || {};

  const [query, setQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);

  const dispatch = useDispatch();
  const { searchResults, status } = useSelector((state) => state.spotify);
  const playlistStatus = useSelector((state) => state.playlist.status);
  
  // 헤더 설정
  useEffect(() => {
    if (isCreatingPlaylist) {
      navigation.setOptions({
        headerShown: true,
        headerTitle: '곡 추가',
        headerStyle: { backgroundColor: '#121212' },
        headerTitleStyle: { color: '#fff' },
        headerTintColor: '#fff',
        headerRight: () => (
          <TouchableOpacity onPress={handleCreatePlaylist} disabled={playlistStatus === 'loading'}>
            <Text style={styles.doneButton}>
              {playlistStatus === 'loading' ? '저장 중...' : '완료'}
            </Text>
          </TouchableOpacity>
        ),
      });
    } else {
        navigation.setOptions({ headerShown: false });
    }
  }, [navigation, isCreatingPlaylist, selectedSongs, playlistStatus]);


  const handleSearch = () => {
    if (query.trim()) dispatch(searchTracks(query));
    else dispatch(clearSearchResults());
  };

  const handleToggleSong = (song) => {
    setSelectedSongs(prev => 
      prev.find(s => s.id === song.id)
        ? prev.filter(s => s.id !== song.id)
        : [...prev, song]
    );
  };
  
  const handleCreatePlaylist = async () => {
    if (selectedSongs.length === 0) {
      Alert.alert('오류', '한 곡 이상 선택해주세요.');
      return;
    }
    const songIds = selectedSongs.map(s => s.id);
    const resultAction = await dispatch(createPlaylist({ 
        title: playlistTitle, 
        description: playlistDescription, 
        songs: songIds 
    }));
    
    if (createPlaylist.fulfilled.match(resultAction)) {
      Alert.alert('성공', '플레이리스트가 생성되었습니다.');
      navigation.navigate('Profile'); // 프로필 화면으로 이동
    } else {
      Alert.alert('오류', resultAction.payload || '플레이리스트 생성에 실패했습니다.');
    }
  };

  const renderTrackItem = ({ item }) => {
    const isSelected = selectedSongs.find(s => s.id === item.id);
    return (
        <TouchableOpacity 
            style={[styles.trackItem, isSelected && styles.selectedTrackItem]} 
            onPress={() => isCreatingPlaylist && handleToggleSong(item)}>
            <SongListItem song={{
                title: item.name,
                artist: item.artists.map(a => a.name).join(', '),
                image: item.album.images[0]?.url,
            }}/>
            {isCreatingPlaylist && (
                <Ionicons 
                    name={isSelected ? "checkmark-circle" : "add-circle-outline"} 
                    size={30} 
                    color={isSelected ? "#1DB954" : "#fff"} />
            )}
        </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {!isCreatingPlaylist && (
        <View style={styles.searchHeader}>
          <Ionicons name="search" size={24} color="#fff" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="검색"
            placeholderTextColor="#a7a7a7"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
        </View>
      )}
      
      {status === 'loading' && <ActivityIndicator size="large" color="#1DB954" />}
      
      <FlatList
        data={searchResults}
        renderItem={renderTrackItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={status !== 'loading' && <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', paddingTop: 50 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#282828', borderRadius: 8, marginHorizontal: 15, marginBottom: 20, paddingHorizontal: 10, height: 50 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: '100%', fontSize: 16, color: '#fff' },
  doneButton: { color: '#1DB954', fontSize: 16, fontWeight: 'bold', marginRight: 15 },
  trackItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  selectedTrackItem: { backgroundColor: '#282828' },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#b3b3b3' },
});

export default SearchScreen;