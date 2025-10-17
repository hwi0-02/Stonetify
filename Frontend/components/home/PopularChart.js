import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';

const placeholderAlbum = require('../../assets/images/placeholder_album.png');

const PopularChart = ({ title, data, onPeriodChange, period }) => {
  const navigation = useNavigation();

  const handleItemPress = (playlistId) => {
    navigation.navigate('PlaylistDetail', { playlistId });
  };

  const renderItem = (item, index) => (
    <TouchableOpacity key={item.id} style={styles.itemContainer} onPress={() => handleItemPress(item.id)}>
      <Text style={styles.rank}>{index + 1}</Text>
      <Image
        source={item.cover_images?.[0] ? { uri: item.cover_images[0] } : placeholderAlbum}
        style={styles.albumArt}
      />
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.user?.display_name || 'Unknown'}</Text>
      </View>
      <View style={styles.likesContainer}>
        <Ionicons name="heart" size={14} color="#1DB954" />
        <Text style={styles.likes}>{item.like_count}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.tabs}>
          
          <TouchableOpacity onPress={() => onPeriodChange('daily')} style={[styles.tab, period === 'daily' && styles.activeTab]}>
            <Text style={[styles.tabText, period === 'daily' && styles.activeTabText]}>day</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onPeriodChange('weekly')} style={[styles.tab, period === 'weekly' && styles.activeTab]}>
            <Text style={[styles.tabText, period === 'weekly' && styles.activeTabText]}>week</Text>
          </TouchableOpacity>
          
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Chart')} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>CHART</Text>
            <Ionicons name="chevron-forward" size={16} color="#b3b3b3" />
        </TouchableOpacity>
      </View>
      <View style={styles.listContainer}>
        {data.length > 0 ? (
          data.map(renderItem)
        ) : (
          <Text style={styles.emptyText}>집계된 인기 플레이리스트가 없습니다.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    container: { marginVertical: 10, paddingHorizontal: 16, marginBottom: 40, },
    headerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: 'white' },
    tabs: { flexDirection: 'row', backgroundColor: '#282828', borderRadius: 8, overflow: 'hidden', marginHorizontal: 12 },
    tab: { paddingVertical: 6, paddingHorizontal: 12 },
    activeTab: { backgroundColor: '#1DB954' },
    tabText: { color: '#b3b3b3', fontSize: 12, fontWeight: 'bold' },
    activeTabText: { color: 'black' },
    seeAllButton: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
    seeAllText: { color: '#b3b3b3', fontSize: 12, fontWeight: 'bold' },
    listContainer: {
      backgroundColor: '#1C1C1C',
      borderRadius: 8,
      padding: 10,
    },
    itemContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    rank: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
      width: 30,
      textAlign: 'center',
    },
    albumArt: {
      width: 45,
      height: 45,
      borderRadius: 4,
      marginHorizontal: 10,
    },
    infoContainer: {
      flex: 1,
    },
    title: {
      color: 'white',
      fontSize: 15,
      fontWeight: '600'
    },
    artist: {
      color: '#b3b3b3',
      fontSize: 13,
      marginTop: 3,
    },
    likesContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 10,
    },
    likes: {
      color: '#1DB954',
      marginLeft: 5,
      fontSize: 13,
    },
    emptyText: {
      color: '#6a6a6a',
      textAlign: 'center',
      padding: 20,
      fontSize: 14,
    }
});

export default PopularChart;