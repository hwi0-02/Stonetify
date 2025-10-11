import React from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PlaylistCard from './playlists/PlaylistCard';

const HorizontalPlaylist = ({ title, data, onPlaylistPress, onItemPress, onSeeAll }) => {
  const handlePress = onItemPress || onPlaylistPress;
  
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && data.length > 0 && (
          <TouchableOpacity onPress={onSeeAll} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>모두 보기</Text>
            <Ionicons name="chevron-forward" size={16} color="#b3b3b3" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <PlaylistCard 
            playlist={item} 
            onPress={() => handlePress && handlePress(item)} 
            showActions={false}
          />
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="musical-notes-outline" size={48} color="#404040" />
            <Text style={styles.emptyText}>아직 플레이리스트가 없습니다</Text>
            <Text style={styles.emptySubtext}>좋아하는 음악으로 첫 플레이리스트를 만들어보세요</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 13,
    color: '#b3b3b3',
    fontWeight: '500',
    marginRight: 4,
  },
  list: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    width: 300,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#b3b3b3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HorizontalPlaylist;