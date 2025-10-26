import React, { useState } from 'react';
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
  showAddButton = false,
  showMenuButton = false,
  onMenuPress,
  onMenuLongPress, // 드래그 함수
  isActive = false,
}) => {
  const [menuPressed, setMenuPressed] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        (menuPressed || isActive) && styles.menuActiveBackground
      ]}
      onPress={() => onPress && onPress(item)}
      disabled={!onPress}
      activeOpacity={1}
    >
      {showMenuButton && (
        <TouchableOpacity
          onPress={onMenuPress}
          onLongPress={onMenuLongPress} // 길게 누르면 drag 시작
          onPressIn={() => setMenuPressed(true)}
          onPressOut={() => setMenuPressed(false)}
          delayLongPress={150}
          style={styles.leftMenuButton}
        >
          <Ionicons name="menu-outline" size={40} color="#fff" />
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
      <View style={styles.actionButtons}>
        {showAddButton && onAddPress && (
          <TouchableOpacity onPress={() => onAddPress(item)} style={styles.addButton}>
            <Ionicons name="add" size={24} color="#1DB954" />
          </TouchableOpacity>
        )}
        <View style={styles.rightButtons}>
          {showLikeButton && (
            <TouchableOpacity onPress={onLikePress}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? "#1DB954" : "#fff"} />
            </TouchableOpacity>
          )}
          {showRemoveButton && (
            <TouchableOpacity onPress={onRemovePress} style={{ marginLeft: 16 }}>
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: 'transparent',
  },
  menuActiveBackground: {
    backgroundColor: '#2d1846',
  },
  leftMenuButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  albumCover: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 15,
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
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  addButton: {
    marginRight: 12, // +와 하트 사이 간격
    padding: 6,
  },
  likeButton: {
    marginRight: 16, // 하트와 삭제 버튼 사이 간격
    padding: 6,
  },
  removeButton: {
    marginRight: 0,
    padding: 6,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});

export default SongListItem;
