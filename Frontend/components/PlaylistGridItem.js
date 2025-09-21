import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

const PlaylistGridItem = ({ playlist, onPress }) => {
  const imageUrl = playlist.cover_image_url;

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