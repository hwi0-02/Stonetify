import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const SongListItem = ({ item, onPress, showRemoveButton, onRemovePress, showLikeButton, onLikePress, liked, onHamburgerPress }) => {
  const imageSize = 56; // 기존 이미지 크기에 맞춰 조절. 필요시 기존 스타일값으로 동기화하세요.

  // 안전한 아티스트 문자열 반환 헬퍼
  const getArtistText = (it) => {
    if (!it) return '';
    if (Array.isArray(it)) return it.join(', ');
    if (typeof it === 'string') return it;
    // 경우에 따라 artists가 객체 배열이면 이름 추출
    if (Array.isArray(it?.map?.(() => {}))) {
      try {
        return it.map(a => a?.name || a?.artist || '').filter(Boolean).join(', ');
      } catch (e) {
        return '';
      }
    }
    return it.artist || it.name || '';
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.leftRow}>
        {/* 추가된 햄버거 버튼: 이미지와 동일한 크기 */}
        <TouchableOpacity
          style={[styles.hamburgerButton, { width: imageSize, height: imageSize }]}
          onPress={(e) => { e && e.stopPropagation && e.stopPropagation(); onHamburgerPress && onHamburgerPress(); }}
        >
          <Ionicons name="reorder-three-outline" size={24} color="#bdbdbd" />
        </TouchableOpacity>

        {/* 앨범 이미지 */}
        <Image
          source={ item?.album_cover_url ? { uri: item.album_cover_url } : require('../assets/images/placeholder_album.png') }
          style={{ width: imageSize, height: imageSize, borderRadius: 4, backgroundColor: '#282828' }}
        />
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>{item.name || item.title}</Text>
        <Text numberOfLines={1} style={styles.artist}>{getArtistText(item.artists || item.artist)}</Text>
      </View>

      <View style={styles.actions}>
        {showLikeButton && (
          <TouchableOpacity onPress={() => onLikePress && onLikePress(item)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#1DB954' : '#bdbdbd'} />
          </TouchableOpacity>
        )}
        {showRemoveButton && (
          <TouchableOpacity onPress={() => onRemovePress && onRemovePress(item)} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={20} color="#ff4444" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    backgroundColor: '#121212',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  hamburgerButton: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  artist: {
    color: '#b3b3b3',
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeButton: {
    marginLeft: 12,
  },
});

export default SongListItem;
