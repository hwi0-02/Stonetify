import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { pauseTrack, resumeTrack, stopTrack } from '../store/slices/playerSlice';

const { width } = Dimensions.get('window');
const placeholderAlbum = require('../assets/images/placeholder_album.png');

const PlayerScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { currentTrack, isPlaying, status } = useSelector((state) => state.player);

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

        <View style={styles.controlsContainer}>
          <TouchableOpacity onPress={handlePlayPause} disabled={status === 'loading'}>
            <Ionicons 
              name={isPlaying ? 'pause-circle' : 'play-circle'} 
              size={80} 
              color={status === 'loading' ? '#555' : 'white'} 
            />
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
});

export default PlayerScreen;
