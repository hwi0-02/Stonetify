import React, { useEffect, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, ActivityIndicator, BackHandler } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import {
  pauseTrack,
  resumeTrack,
  nextTrack,
  previousTrack,
  toggleRepeat,
  toggleShuffle,
  setSeekInProgress,
  setPosition,
  setPlayerScreenVisible,
} from '../store/slices/playerSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { colors as palette, createStyles } from '../utils/ui';
import { textVariants, pressableHitSlop } from '../utils/uiComponents';

const { width } = Dimensions.get('window');
const placeholderAlbum = require('../assets/images/placeholder_album.png');

const PlayerScreen = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const {
    currentTrack,
    isPlaying,
    status,
    position,
    duration,
    repeatMode,
    isShuffle,
  } = useAppSelector((state) => state.player);

  useEffect(() => {
    // If the screen is opened without a track, or the track is stopped elsewhere,
    // navigate back.
    if (!currentTrack) {
      navigation.goBack();
    }
  }, [currentTrack, navigation]);

  // PlayerScreen이 활성화/비활성화될 때 MiniPlayer 표시 제어
  useFocusEffect(
    useCallback(() => {
      // 화면이 포커스되면 MiniPlayer 숨김
      dispatch(setPlayerScreenVisible(true));

      // Android 뒤로가기 버튼 처리
      const onBackPress = () => {
        navigation.goBack();
        return true; // 기본 뒤로가기 동작 방지
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        // 화면이 블러되면 MiniPlayer 표시
        dispatch(setPlayerScreenVisible(false));
        backHandler.remove();
      };
    }, [dispatch, navigation])
  );

  const handleClose = () => {
    navigation.goBack();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      dispatch(pauseTrack());
    } else {
      dispatch(resumeTrack());
    }
  };

  const handleNext = () => dispatch(nextTrack());
  const handlePrev = () => dispatch(previousTrack());
  const handleRepeat = () => dispatch(toggleRepeat());
  const handleShuffle = () => dispatch(toggleShuffle());

  const formatTime = useCallback((ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0'+s : s}`;
  }, []);

  const onSlidingStart = () => dispatch(setSeekInProgress(true));
  const onSlidingComplete = (val) => {
    dispatch(setSeekInProgress(false));
    dispatch(setPosition(Math.floor(val)));
  };

  if (__DEV__) {
    console.log('[PlayerScreen]', { position, duration, repeatMode, isShuffle, seekInProgress });
  }

  if (!currentTrack) {
    // This is a fallback, useEffect should handle navigation.
    return (
        <View style={styles.container} />
    );
  }

  return (
    <LinearGradient colors={[palette.accentSecondary, palette.background]} style={styles.container}>
      <TouchableOpacity
        onPress={handleClose}
        style={styles.downButton}
        hitSlop={pressableHitSlop}
      >
        <Ionicons name="chevron-down" size={28} color={palette.textPrimary} />
      </TouchableOpacity>
      
      <View style={styles.content}>
        <View style={styles.albumArtContainer}>
            <Image 
                source={currentTrack.album_cover_url ? { uri: currentTrack.album_cover_url } : placeholderAlbum} 
                style={styles.albumArt} 
            />
            {status === 'loading' && (
                <ActivityIndicator style={styles.loadingIndicator} size="large" color={palette.textPrimary} />
            )}
        </View>

        <View style={styles.songDetails}>
          <Text style={styles.title}>{currentTrack.name}</Text>
          <Text style={styles.artist}>{currentTrack.artists}</Text>
        </View>

        <View style={styles.progressSection}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration || 0}
            value={position}
            minimumTrackTintColor={palette.textPrimary}
            maximumTrackTintColor={palette.textMuted}
            thumbTintColor={palette.textPrimary}
            onSlidingStart={onSlidingStart}
            onSlidingComplete={onSlidingComplete}
            disabled={!duration}
          />
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(position)}</Text>
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity onPress={handleShuffle} style={styles.smallBtn} hitSlop={pressableHitSlop}>
            <Ionicons name="shuffle" size={24} color={isShuffle ? palette.accent : palette.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrev} style={styles.smallBtn} hitSlop={pressableHitSlop}>
            <Ionicons name="play-skip-back" size={38} color={palette.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePlayPause} disabled={status === 'loading'} hitSlop={pressableHitSlop}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={88}
              color={status === 'loading' ? palette.textMuted : palette.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} style={styles.smallBtn} hitSlop={pressableHitSlop}>
            <Ionicons name="play-skip-forward" size={38} color={palette.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRepeat} style={styles.smallBtn} hitSlop={pressableHitSlop}>
            <Ionicons
              name={repeatMode === 'track' ? 'repeat' : repeatMode === 'queue' ? 'repeat' : 'repeat'}
              size={26}
              color={repeatMode !== 'off' ? palette.accent : palette.textPrimary}
            />
            {repeatMode === 'track' && (
              <View style={styles.repeatOneBadge}>
                <Text style={styles.repeatOneText}>1</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
  container: {
    flex: 1,
  },
  downButton: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    zIndex: 1,
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  albumArtContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  albumArt: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: radii.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceMuted,
  },
  loadingIndicator: {
    position: 'absolute',
  },
  songDetails: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.heading,
    fontSize: 24,
    textAlign: 'center',
  },
  artist: {
    ...textVariants.subtitle,
    fontSize: 16,
  },
  progressSection: {
    width: '100%',
    gap: spacing.xs,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  time: {
    ...textVariants.meta,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  smallBtn: {
    padding: spacing.sm,
    position: 'relative',
  },
  repeatOneBadge: {
    position: 'absolute',
    top: spacing.xxs,
    right: spacing.xxs,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xxs,
    paddingVertical: 2,
  },
  repeatOneText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '700',
  },
}));

export default PlayerScreen;
