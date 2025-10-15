import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors as palette, createStyles } from '../utils/ui';
import {
  listItem as listItemStyle,
  textVariants,
  pressableHitSlop,
} from '../utils/uiComponents';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
  container: {
    ...listItemStyle({ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }),
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  albumCover: {
    width: 50,
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.muted,
  },
  songInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.subheading,
    fontSize: 16,
  },
  artist: {
    ...textVariants.subtitle,
    fontSize: 13,
  },
  iconButton: {
    padding: spacing.xs,
  },
  removeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
}));

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
}) => {
  const artistName = Array.isArray(item.artists)
    ? item.artists.join(', ')
    : item.artists || item.artist || '알 수 없는 아티스트';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress ? () => onPress(item) : undefined}
      disabled={!onPress}
      activeOpacity={0.85}
    >
      <Image
        source={item.album_cover_url ? { uri: item.album_cover_url } : placeholderAlbum}
        style={styles.albumCover}
      />
      <View style={styles.songInfo}>
        <Text style={styles.title} numberOfLines={1}>{item.name || item.title || '제목 없음'}</Text>
        <Text style={styles.artist} numberOfLines={1}>{artistName}</Text>
      </View>
      {showPlayButton && (
        <TouchableOpacity
          onPress={onPlayPress ? () => onPlayPress(item) : undefined}
          style={styles.iconButton}
          disabled={!onPlayPress}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="play-circle" size={26} color={palette.accent} />
        </TouchableOpacity>
      )}
      {showLikeButton && (
        <TouchableOpacity
          onPress={onLikePress ? () => onLikePress(item) : undefined}
          style={styles.iconButton}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? palette.accent : '#fff'} />
        </TouchableOpacity>
      )}
      {showRemoveButton && onRemovePress && (
        <TouchableOpacity
          onPress={() => onRemovePress(item)}
          style={styles.removeButton}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="trash-outline" size={18} color={palette.danger} />
        </TouchableOpacity>
      )}
      {onAddPress && (
        <TouchableOpacity
          onPress={() => onAddPress(item)}
          style={styles.iconButton}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

SongListItem.propTypes = {
  item: PropTypes.shape({
    album_cover_url: PropTypes.string,
    name: PropTypes.string,
    title: PropTypes.string,
    artists: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string),
    ]),
    artist: PropTypes.string,
  }).isRequired,
  onPress: PropTypes.func,
  onAddPress: PropTypes.func,
  onRemovePress: PropTypes.func,
  showRemoveButton: PropTypes.bool,
  showLikeButton: PropTypes.bool,
  onLikePress: PropTypes.func,
  liked: PropTypes.bool,
  showPlayButton: PropTypes.bool,
  onPlayPress: PropTypes.func,
};

SongListItem.defaultProps = {
  onPress: undefined,
  onAddPress: undefined,
  onRemovePress: undefined,
  showRemoveButton: false,
  showLikeButton: false,
  onLikePress: undefined,
  liked: false,
  showPlayButton: false,
  onPlayPress: undefined,
};

export default SongListItem;
