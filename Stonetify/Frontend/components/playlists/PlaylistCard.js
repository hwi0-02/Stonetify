import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

// 플레이리스트 목록에 표시될 개별 카드 컴포넌트
const PlaylistCard = ({ playlist, onPress }) => {
  // 플레이리스트에 곡이 있는 경우 첫 번째 곡의 앨범 아트를 썸네일로 사용
  const imageUrl = playlist.songs && playlist.songs.length > 0
    ? playlist.songs[0].albumImageUrl // 실제 Spotify API 연동 시 앨범 이미지 URL 필드명으로 변경해야 합니다.
    : 'https://via.placeholder.com/150'; // 기본 이미지

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress}>
      <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{playlist.title}</Text>
        <Text style={styles.description}>{playlist.description}</Text>
        <Text style={styles.user}>{playlist.user?.display_name || 'Unknown User'}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  user: {
    fontSize: 12,
    color: '#888',
  },
});

export default PlaylistCard;