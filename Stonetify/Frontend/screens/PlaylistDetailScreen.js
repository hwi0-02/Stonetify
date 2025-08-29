import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPlaylistDetails } from '../store/slices/playlistSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SongListItem from '../components/SongListItem';

const placeholderAlbum = require('../assets/images/placeholder_album.png');

const PlaylistDetailScreen = ({ route, navigation }) => {
  const { playlistId } = route.params;
  const dispatch = useDispatch();
  const { currentPlaylist, status, error } = useSelector((state) => state.playlist);

  useEffect(() => {
    if (playlistId) {
      dispatch(fetchPlaylistDetails(playlistId));
    }
  }, [dispatch, playlistId]);

  const imageUrl = currentPlaylist?.songs?.[0]?.album?.images?.[0]?.url;

  if (status === 'loading' || !currentPlaylist) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView>
        <LinearGradient colors={['#4c1e6e', '#121212']} style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Image 
                source={imageUrl ? { uri: imageUrl } : placeholderAlbum} 
                style={styles.playlistImage}
            />
            <Text style={styles.title}>{currentPlaylist.title}</Text>
            <Text style={styles.description}>{currentPlaylist.description}</Text>
            <Text style={styles.creator}>By {currentPlaylist.user.display_name}</Text>
            <TouchableOpacity style={styles.playButton}>
                <Ionicons name="play-circle" size={60} color="#1DB954" />
            </TouchableOpacity>
        </LinearGradient>

        <FlatList
          data={currentPlaylist.songs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <SongListItem song={item} />}
          scrollEnabled={false} // To scroll with the main ScrollView
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  header: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
      position: 'absolute',
      top: 40,
      left: 20,
  },
  playlistImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  description: {
      color: '#b3b3b3',
      fontSize: 15,
      textAlign: 'center',
      marginTop: 8,
  },
  creator: {
      color: '#fff',
      fontSize: 16,
      marginTop: 12,
      fontWeight: '600'
  },
  playButton: {
      marginTop: 20,
  }
});

export default PlaylistDetailScreen;