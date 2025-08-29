import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { searchTracks, addSongToPlaylist } from '../api/ApiService';

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    if (!query) return;
    try {
      const response = await searchTracks(query);
      setResults(response.data.data);
    } catch (error) {
      Alert.alert("검색 실패", "음악을 검색하는 중 오류가 발생했습니다.");
    }
  };
  
  const handleAddSong = (song) => {
    Alert.alert(
      "곡 추가",
      `'${song.title}'을(를) 어떤 플레이리스트에 추가하시겠습니까? (현재는 ID 1번에 추가)`,
      [
        { text: "취소", style: "cancel" },
        { text: "추가", onPress: async () => {
            try {
              // TODO: 사용자의 플레이리스트 목록을 보여주고 선택하게 해야 함
              await addSongToPlaylist(1, song); 
              Alert.alert("성공", "플레이리스트에 곡을 추가했습니다.");
            } catch (err) {
              Alert.alert("오류", err.response?.data?.message || "추가에 실패했습니다.");
            }
          } 
        }
      ]
    );
  };

  const SongItem = ({ item }) => (
    <TouchableOpacity style={styles.songContainer} onPress={() => handleAddSong(item)}>
      <View>
        <Text style={styles.songTitle}>{item.title}</Text>
        <Text style={styles.songArtist}>{item.artist}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>음악 검색</Text>
      <TextInput
        style={styles.input}
        placeholder="아티스트, 곡 제목으로 검색"
        placeholderTextColor="#B3B3B3"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
      />
      <FlatList
        data={results}
        renderItem={SongItem}
        keyExtractor={(item) => item.spotify_id}
        ListEmptyComponent={<Text style={styles.emptyText}>검색 결과가 없습니다.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { fontSize: 32, fontWeight: 'bold', color: 'white', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  input: { backgroundColor: '#282828', color: 'white', padding: 15, borderRadius: 8, marginHorizontal: 20, marginBottom: 20, fontSize: 16, },
  songContainer: { paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#282828', },
  songTitle: { color: 'white', fontSize: 16 },
  songArtist: { color: '#B3B3B3' },
  emptyText: { color: '#B3B3B3', textAlign: 'center', marginTop: 50 },
});

export default SearchScreen;