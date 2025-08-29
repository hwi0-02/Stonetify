import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import PlaylistCard from './playlists/PlaylistCard';

const HorizontalPlaylist = ({ title, playlists, onPlaylistPress }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PlaylistCard 
            playlist={item} 
            onPress={() => onPlaylistPress(item.id)} 
          />
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>플레이리스트가 없습니다.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  list: {
    paddingHorizontal: 20,
  },
  emptyText: {
      color: '#a7a7a7',
      paddingHorizontal: 20,
  }
});

export default HorizontalPlaylist;