import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { pauseTrack, resumeTrack, stopTrack, nextTrack, previousTrack, toggleRepeat, toggleShuffle, setSeekInProgress, setPosition } from '../store/slices/playerSlice';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');
const placeholderAlbum = require('../assets/images/placeholder_album.png');

const PlayerScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { currentTrack, isPlaying, status, position, duration, repeatMode, isShuffle, seekInProgress } = useSelector((state) => state.player);

  useEffect(() => {
    // If the screen is opened without a track, or the track is stopped elsewhere,
    // navigate back.
    if (!currentTrack) {
      navigation.goBack();
    }
  }, [currentTrack, navigation]);

  const handleClose = () => {
    dispatch(stopTrack());
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
    <LinearGradient colors={['#4c1e6e', '#121212']} style={styles.container}>
      <TouchableOpacity onPress={handleClose} style={styles.downButton}>
        <Ionicons name="chevron-down" size={32} color="white" />
      </TouchableOpacity>
      
      <View style={styles.content}>
        <View style={styles.albumArtContainer}>
            <Image 
                source={currentTrack.album_cover_url ? { uri: currentTrack.album_cover_url } : placeholderAlbum} 
                style={styles.albumArt} 
            />
            {status === 'loading' && (
                <ActivityIndicator style={styles.loadingIndicator} size="large" color="#fff" />
            )}
        </View>

        <View style={styles.songDetails}>
          <Text style={styles.title}>{currentTrack.name}</Text>
          <Text style={styles.artist}>{currentTrack.artists}</Text>
        </View>

        <View style={styles.progressSection}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={duration || 0}
            value={position}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="#555"
            thumbTintColor="#fff"
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
          <TouchableOpacity onPress={handleShuffle} style={styles.smallBtn}>
            <Ionicons name="shuffle" size={26} color={isShuffle ? '#1DB954' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrev} style={styles.smallBtn}>
            <Ionicons name="play-skip-back" size={40} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePlayPause} disabled={status === 'loading'}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={88}
              color={status === 'loading' ? '#555' : '#fff'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} style={styles.smallBtn}>
            <Ionicons name="play-skip-forward" size={40} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRepeat} style={styles.smallBtn}>
            <Ionicons
              name={repeatMode === 'track' ? 'repeat' : repeatMode === 'queue' ? 'repeat' : 'repeat'}
              size={26}
              color={repeatMode !== 'off' ? '#1DB954' : '#fff'}
            />
            {repeatMode === 'track' && <View style={styles.repeatOneBadge}><Text style={styles.repeatOneText}>1</Text></View>}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  downButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  albumArtContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumArt: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 12,
    marginBottom: 60,
  },
  loadingIndicator: {
    position: 'absolute',
  },
  songDetails: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  artist: {
    fontSize: 18,
    color: '#b3b3b3',
    marginTop: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  progressSection: { width: '100%', marginBottom: 20 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  time: { color: '#bbb', fontSize: 12 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 10, position: 'relative' },
  repeatOneBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#1DB954', borderRadius: 8, paddingHorizontal: 4 },
  repeatOneText: { color: '#000', fontSize: 10, fontWeight: '700' },
});

export default PlayerScreen;
