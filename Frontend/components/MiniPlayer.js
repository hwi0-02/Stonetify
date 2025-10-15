import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { pauseTrack, resumeTrack, nextTrack } from '../store/slices/playerSlice';
import placeholderAlbum from '../assets/images/placeholder_album.png';
import { useNavigation } from '@react-navigation/native';
import { createStyles } from '../utils/ui';
import { listItem as listItemStyle, textVariants, pressableHitSlop } from '../utils/uiComponents';
import { useAppDispatch, useAppSelector } from '../store/hooks';

export const MINI_PLAYER_HEIGHT = 72;

const styles = createStyles(({ colors, spacing, typography }) => ({
  container: {
    ...listItemStyle({ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, withDivider: false }),
    backgroundColor: colors.surface,
    height: MINI_PLAYER_HEIGHT,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  art: {
    width: 44,
    height: 44,
    borderRadius: spacing.xs,
    backgroundColor: colors.muted,
  },
  meta: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.subheading,
    fontSize: 14,
  },
  artist: {
    ...textVariants.subtitle,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    padding: spacing.xs,
  },
}));

const MiniPlayer = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const { currentTrack, isPlaying } = useAppSelector((state) => state.player);

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
          source={currentTrack.album_cover_url ? { uri: currentTrack.album_cover_url } : placeholderAlbum}
          style={styles.art}
        />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>{artistText}</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity onPress={handlePlayPause} style={styles.iconBtn} hitSlop={pressableHitSlop}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNext} style={styles.iconBtn} hitSlop={pressableHitSlop}>
          <Ionicons name="play-skip-forward" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default MiniPlayer;
