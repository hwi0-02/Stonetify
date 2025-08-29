import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

const PlaylistGridItem = ({ playlist, onPress }) => {
  // playlist.songs가 있고, 그 안에 첫 번째 곡의 album.images가 있는지 확인
  const imageUrl = playlist.songs?.[0]?.album?.images?.[0]?.url;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Image 
        source={imageUrl ? { uri: imageUrl } : placeholderAlbum} 
        style={styles.thumbnail}
      />
      <Text style={styles.title} numberOfLines={1}>{playlist.title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 5,
    maxWidth: '48%', // 2열 그리드를 위해
    alignItems: 'center',
  },
  thumbnail: {
    width: 150,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PlaylistGridItem;