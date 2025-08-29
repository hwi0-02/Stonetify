import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SongListItem = ({ song, onPress, onMorePress }) => {
  const imageUrl = song.album?.images?.[0]?.url;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image 
        source={imageUrl ? { uri: imageUrl } : require('../assets/images/placeholder_album.png')} 
        style={styles.albumArt}
      />
      <View style={styles.songInfo}>
        <Text style={styles.title} numberOfLines={1}>{song.name || song.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{song.artists?.map(a => a.name).join(', ') || song.artist}</Text>
      </View>
      <TouchableOpacity onPress={onMorePress} style={styles.moreButton}>
        <Ionicons name="ellipsis-vertical" size={24} color="#a7a7a7" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#333',
    marginRight: 15,
  },
  songInfo: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  artist: {
    color: '#a7a7a7',
    fontSize: 14,
    marginTop: 4,
  },
  moreButton: {
    paddingLeft: 15, // 터치 영역 확보
  },
});

export default SongListItem;