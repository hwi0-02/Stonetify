import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

const SongListItem = ({
  item,
  onPress,
  onAddPress,
  onRemovePress,
  showRemoveButton = false,
  showLikeButton = false,
  onLikePress,
  liked = false,
  showPlayButton = false,
  onPlayPress,
  showHamburgerButton = false,
  onHamburgerPress,
}) => {
  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress && onPress(item)} disabled={!onPress}>
      {showHamburgerButton && (
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={() => onHamburgerPress && onHamburgerPress(item)}
          disabled={!onHamburgerPress}
        >
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
      )}
      <Image
        source={item.album_cover_url ? { uri: item.album_cover_url } : placeholderAlbum}
        style={styles.albumCover}
      />
      <View style={styles.songInfo}>
        <Text style={styles.title} numberOfLines={1}>{item.name || item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artists || item.artist}</Text>
      </View>
      {showPlayButton && (
        <TouchableOpacity
          onPress={() => onPlayPress && onPlayPress(item)}
          style={styles.playButton}
          disabled={!onPlayPress}
        >
          <Ionicons name="play-circle" size={30} color="#1DB954" />
        </TouchableOpacity>
      )}
      {showLikeButton && (
        <TouchableOpacity onPress={() => onLikePress && onLikePress(item)} style={styles.likeButton}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#1DB954' : '#fff'} />
        </TouchableOpacity>
      )}
      {showRemoveButton && onRemovePress && (
        <TouchableOpacity onPress={() => onRemovePress(item)} style={styles.removeButton}>
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </TouchableOpacity>
      )}
      {onAddPress && (
        <TouchableOpacity onPress={() => onAddPress(item)} style={styles.addButton}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 15,
    paddingLeft: 0,
    marginLeft: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  hamburgerButton: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 0,
  },
  albumCover: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 12,
  },
  songInfo: {
    flex: 1, // 차지할 수 있는 모든 공간을 차지하도록 설정
    justifyContent: 'center',
    marginRight: 10,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  artist: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 3,
  },
  addButton: {
    padding: 5,
  },
  playButton: {
    padding: 6,
    marginRight: 6,
  },
  removeButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  likeButton: {
    padding: 6,
    marginRight: 8,
  }
});

export default SongListItem;
