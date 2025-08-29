import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

// 4개 이미지 격자를 렌더링하는 컴포넌트
const PlaylistThumbnail = ({ coverImages }) => {
  const placeholderUrl = 'https://via.placeholder.com/150/1a1a1a/1DB954?text=♪';
  
  // 4개의 이미지 슬롯 준비 (부족한 경우 placeholder로 채움)
  const imageSlots = Array(4).fill(null).map((_, index) => {
    return coverImages[index] || placeholderUrl;
  });

  return (
    <View style={styles.thumbnailGrid}>
      <View style={styles.gridRow}>
        <Image source={{ uri: imageSlots[0] }} style={styles.gridImage} />
        <Image source={{ uri: imageSlots[1] }} style={styles.gridImage} />
      </View>
      <View style={styles.gridRow}>
        <Image source={{ uri: imageSlots[2] }} style={styles.gridImage} />
        <Image source={{ uri: imageSlots[3] }} style={styles.gridImage} />
      </View>
    </View>
  );
};

// Spotify 스타일 플레이리스트 카드 컴포넌트
const PlaylistCard = ({ playlist, onPress }) => {
  const coverImages = playlist.cover_images || [];

  return (
    <TouchableOpacity style={styles.cardContainer} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.imageContainer}>
        <PlaylistThumbnail coverImages={coverImages} />
        <View style={styles.playButton}>
          <Ionicons name="play" size={20} color="#121212" />
        </View>
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>{playlist.title}</Text>
        {playlist.description ? (
          <Text style={styles.description} numberOfLines={2}>{playlist.description}</Text>
        ) : null}
        {playlist.user?.display_name && (
          <Text style={styles.creator}>By {playlist.user.display_name}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: 170,
    marginRight: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    transform: [{ scale: 1 }],
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  thumbnailGrid: {
    width: '100%',
    height: 138,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#282828',
  },
  gridRow: {
    flexDirection: 'row',
    flex: 1,
  },
  gridImage: {
    flex: 1,
    height: '100%',
    backgroundColor: '#282828',
    borderWidth: 0.5,
    borderColor: '#1a1a1a',
  },
  playButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    opacity: 0.9,
  },
  infoContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    color: '#a7a7a7',
    marginBottom: 6,
    lineHeight: 16,
    fontWeight: '500',
  },
  creator: {
    fontSize: 11,
    color: '#6a6a6a',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default PlaylistCard;