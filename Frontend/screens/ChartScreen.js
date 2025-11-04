// Frontend/screens/ChartScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { fetchPopularPlaylists } from '../store/slices/playlistSlice';
import SongListItem from '../components/SongListItem'; 

const placeholderAlbum = require('../assets/images/placeholder_album.png');

const ChartScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { popularPlaylists, status } = useSelector((state) => state.playlist);
  const [period, setPeriod] = useState('weekly'); // 'daily' | 'weekly'

  useEffect(() => {
    dispatch(fetchPopularPlaylists({ period, limit: 50 }));
  }, [dispatch, period]);

  const handlePlaylistPress = (playlistId) => {
    navigation.navigate('PlaylistDetail', { playlistId });
  };

  const renderItem = useCallback(({ item, index }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => handlePlaylistPress(item.id)}>
      <Text style={styles.rank}>{index + 1}</Text>
      <Image
        source={item.cover_images?.[0] ? { uri: item.cover_images[0] } : placeholderAlbum}
        style={styles.albumArt}
        cachePolicy="memory-disk"
        contentFit="cover"
        transition={200}
      />
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.user?.display_name || 'Unknown'}</Text>
      </View>
      <View style={styles.likesContainer}>
        <Ionicons name="heart" size={16} color="#d84753ff" />
        <Text style={styles.likes}>{item.like_count}</Text>
      </View>
    </TouchableOpacity>
  ), [handlePlaylistPress]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>플레이리스트 인기 차트</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabContainer}>

        <TouchableOpacity
          style={[styles.tabButton, period === 'daily' && styles.activeTab]}
          onPress={() => setPeriod('daily')}
        >
          <Text style={[styles.tabText, period === 'daily' && styles.activeTabText]}>일간</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, period === 'weekly' && styles.activeTab]}
          onPress={() => setPeriod('weekly')}
        >
          <Text style={[styles.tabText, period === 'weekly' && styles.activeTabText]}>주간</Text>
        </TouchableOpacity>
      </View>

      {status === 'loading' && popularPlaylists.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#fff" />
      ) : (
        <FlatList
          data={popularPlaylists}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          maxToRenderPerBatch={5}
          windowSize={10}
          removeClippedSubviews={false}
          updateCellsBatchingPeriod={50}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
    headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    tabContainer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 10, backgroundColor: '#282828', borderRadius: 8, marginHorizontal: 20, overflow: 'hidden' },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
    activeTab: { backgroundColor: '#b04ad8ff' },
    tabText: { color: 'white', fontWeight: 'bold' },
    activeTabText: { color: '#121212' },
    listContent: { paddingBottom: 50 },
    itemContainer: { flexDirection: 'row', alignItems: 'center', padding: 15 },
    rank: { color: 'white', fontSize: 16, fontWeight: 'bold', width: 30 },
    albumArt: {
        width: 50,
        height: 50,
        borderRadius: 4,
        marginRight: 15,
        backgroundColor: '#333',
    },
    infoContainer: { flex: 1, marginRight: 10 },
    title: { color: 'white', fontSize: 16 },
    artist: { color: '#b3b3b3', fontSize: 14, marginTop: 4 },
    likesContainer: { flexDirection: 'row', alignItems: 'center' },
    likes: { color: '#ffffffff', marginLeft: 5 },
});

export default ChartScreen;