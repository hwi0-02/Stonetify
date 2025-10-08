import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { pauseTrack, resumeTrack, nextTrack } from '../store/slices/playerSlice';
import placeholderAlbum from '../assets/images/placeholder_album.png';
import { useNavigation } from '@react-navigation/native';

export const MINI_PLAYER_HEIGHT = 72;

const MiniPlayer = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { currentTrack, isPlaying, queueIndex, queue, adapterType } = useSelector(s => s.player);

  if (!currentTrack) return null;

  const handlePlayPause = () => {
    if (isPlaying) dispatch(pauseTrack());
    else dispatch(resumeTrack());
  };

  const handleNext = () => dispatch(nextTrack());

  const handleExpand = () => {
    navigation.navigate('Player');
  };

  // 안전하게 artists 처리
  const artistText = Array.isArray(currentTrack.artists)
    ? currentTrack.artists.map(a => a.name).join(', ')
    : currentTrack.artists?.name || currentTrack.artists || '';

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.85} onPress={handleExpand}>
      <View style={styles.left}>
        <Image
          source={currentTrack.album?.images?.[0]?.url ? { uri: currentTrack.album.images[0].url } : placeholderAlbum}
          style={styles.art}
        />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.name}</Text>
          <View style={styles.row}>
            <Text style={styles.artist} numberOfLines={1}>{artistText}</Text>
            <View style={[styles.badge, adapterType === 'preview' ? styles.badgePreview : styles.badgeFull]}>
              <Text style={styles.badgeText}>{adapterType === 'preview' ? 'Preview' : 'Full'}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity onPress={handlePlayPause} style={styles.iconBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNext} style={styles.iconBtn}>
          <Ionicons name="play-skip-forward" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e1e',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    height: MINI_PLAYER_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333'
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  art: { width: 44, height: 44, borderRadius: 4, backgroundColor: '#333' },
  meta: { marginLeft: 10, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artist: { color: '#bbb', fontSize: 12, marginTop: 2, flexShrink: 1, maxWidth: '70%' },
  badge: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgePreview: { backgroundColor: '#444' },
  badgeFull: { backgroundColor: '#1DB954' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 8 }
});

export default MiniPlayer;
