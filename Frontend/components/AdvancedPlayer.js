import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Slider } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import placeholderAlbum from '../assets/images/placeholder_album.png';
import { useSelector, useDispatch } from 'react-redux';
import { 
  playTrack, 
  pauseTrack, 
  resumeTrack, 
  stopTrack,
  setVolume,
  setPosition
} from '../store/slices/playerSlice';

const AdvancedPlayer = () => {
  const dispatch = useDispatch();
  const { 
    currentTrack, 
    isPlaying, 
    volume, 
    position, 
    duration, 
    isRepeat, 
    isShuffle 
  } = useSelector(state => state.player);

  const [localPosition, setLocalPosition] = useState(0);
  const [showVolumeControl, setShowVolumeControl] = useState(false);

  useEffect(() => {
    setLocalPosition(position);
  }, [position]);

  const handlePlayPause = () => {
    if (isPlaying) {
      dispatch(pauseTrack());
    } else if (currentTrack) {
      dispatch(resumeTrack());
    }
  };

  const handleStop = () => {
    dispatch(stopTrack());
  };

  const handleVolumeChange = (newVolume) => {
    dispatch(setVolume(newVolume));
  };

  const handlePositionChange = (newPosition) => {
    setLocalPosition(newPosition);
  };

  const handlePositionChangeComplete = (newPosition) => {
    dispatch(setPosition(newPosition));
  };

  const formatTime = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <View style={styles.emptyPlayer}>
        <Ionicons name="musical-notes-outline" size={48} color="#666" />
        <Text style={styles.emptyText}>재생 중인 곡이 없습니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 앨범 아트 */}
      <View style={styles.albumArtContainer}>
        <Image 
          source={currentTrack.album?.images?.[0]?.url ? { uri: currentTrack.album.images[0].url } : placeholderAlbum}
          style={styles.albumArt}
          contentFit="cover"
        />
      </View>

      {/* 곡 정보 */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackName} numberOfLines={1}>
          {currentTrack.name}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {currentTrack.artists?.map(artist => artist.name).join(', ')}
        </Text>
      </View>

      {/* 재생 진행 바 */}
      <View style={styles.progressContainer}>
        <Text style={styles.timeText}>{formatTime(localPosition)}</Text>
        <Slider
          style={styles.progressSlider}
          minimumValue={0}
          maximumValue={duration}
          value={localPosition}
          onValueChange={handlePositionChange}
          onSlidingComplete={handlePositionChangeComplete}
          minimumTrackTintColor="#1DB954"
          maximumTrackTintColor="#404040"
          thumbTintColor="#1DB954"
        />
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>

      {/* 컨트롤 버튼들 */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons 
            name={isShuffle ? "shuffle" : "shuffle-outline"} 
            size={24} 
            color={isShuffle ? "#1DB954" : "#ffffff"} 
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="play-skip-back" size={28} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Ionicons 
            name={isPlaying ? "pause" : "play"} 
            size={32} 
            color="#000000" 
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="play-skip-forward" size={28} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton}>
          <Ionicons 
            name={isRepeat ? "repeat" : "repeat-outline"} 
            size={24} 
            color={isRepeat ? "#1DB954" : "#ffffff"} 
          />
        </TouchableOpacity>
      </View>

      {/* 하단 컨트롤 */}
      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="list" size={24} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.volumeContainer}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowVolumeControl(!showVolumeControl)}
          >
            <Ionicons 
              name={volume === 0 ? "volume-mute" : volume < 0.5 ? "volume-low" : "volume-high"} 
              size={24} 
              color="#ffffff" 
            />
          </TouchableOpacity>
          {showVolumeControl && (
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              value={volume}
              onValueChange={handleVolumeChange}
              minimumTrackTintColor="#1DB954"
              maximumTrackTintColor="#404040"
              thumbTintColor="#1DB954"
            />
          )}
        </View>

        <TouchableOpacity style={styles.iconButton} onPress={handleStop}>
          <Ionicons name="stop" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121212',
    padding: 20,
    alignItems: 'center',
  },
  emptyPlayer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#121212',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  albumArtContainer: {
    width: 280,
    height: 280,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  albumArt: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  trackName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  artistName: {
    fontSize: 16,
    color: '#b3b3b3',
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  progressSlider: {
    flex: 1,
    height: 40,
    marginHorizontal: 12,
  },
  timeText: {
    color: '#b3b3b3',
    fontSize: 12,
    width: 40,
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
  },
  controlButton: {
    padding: 12,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  iconButton: {
    padding: 12,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: 150,
  },
  volumeSlider: {
    flex: 1,
    height: 40,
    marginLeft: 8,
  },
});

export default AdvancedPlayer;
