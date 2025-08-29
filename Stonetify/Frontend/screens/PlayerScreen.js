import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const PlayerScreen = ({ route, navigation }) => {
  // In a real app, you'd get the current song from a global player state (e.g., Redux)
  const { song } = route.params || {}; 

  const currentSong = song || {
      name: 'Song Title',
      artist: 'Artist Name',
      album: {
          images: [{ url: 'https://via.placeholder.com/500' }]
      }
  };

  return (
    <LinearGradient colors={['#8E44AD', '#121212']} style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.downButton}>
            <Ionicons name="chevron-down" size={32} color="white" />
        </TouchableOpacity>
        
        <View style={styles.content}>
            <Image source={{ uri: currentSong.album.images[0].url }} style={styles.albumArt} />
            <View style={styles.songDetails}>
                <Text style={styles.title}>{currentSong.name}</Text>
                <Text style={styles.artist}>{currentSong.artist}</Text>
            </View>

            {/* Progress Bar - Placeholder */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBar} />
            </View>
            <View style={styles.timeContainer}>
                <Text style={styles.timeText}>0:00</Text>
                <Text style={styles.timeText}>3:00</Text>
            </View>

            {/* Controls */}
            <View style={styles.controlsContainer}>
                <Ionicons name="shuffle" size={30} color="#b3b3b3" />
                <Ionicons name="play-skip-back" size={40} color="white" />
                <Ionicons name="play-circle" size={80} color="white" />
                <Ionicons name="play-skip-forward" size={40} color="white" />
                <Ionicons name="repeat" size={30} color="#1DB954" />
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
  albumArt: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 12,
    marginBottom: 40,
  },
  songDetails: {
      alignItems: 'center',
      marginBottom: 30,
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
  progressContainer: {
      width: '100%',
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: 2,
      marginTop: 20,
  },
  progressBar: {
      height: '100%',
      width: '30%', // Placeholder
      backgroundColor: '#fff',
      borderRadius: 2,
  },
  timeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      marginTop: 8,
  },
  timeText: {
      color: '#b3b3b3',
      fontSize: 12,
  },
  controlsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      width: '100%',
      marginTop: 40,
  }
});

export default PlayerScreen;