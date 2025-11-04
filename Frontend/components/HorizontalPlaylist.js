import React, { memo } from 'react';
import { FlatList, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PlaylistCard from './playlists/PlaylistCard';

const HorizontalPlaylist = memo(({ title, data, onPlaylistPress, onItemPress, onSeeAll, coverOnly = false }) => {
  const handlePress = onItemPress || onPlaylistPress;

  const normalizedData = Array.isArray(data) ? data.filter(Boolean) : [];
  const uniqueData = [];
  const seen = new Set();

  normalizedData.forEach((item, index) => {
    const id = item?.id;
    if (id !== undefined && id !== null) {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
    }
    uniqueData.push(item);
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{title}</Text>
        {onSeeAll && uniqueData.length > 0 && (
          <TouchableOpacity onPress={onSeeAll} style={styles.seeAllButton}>
            <Text style={styles.seeAllText}>모두 보기</Text>
            <Ionicons name="chevron-forward" size={16} color="#b3b3b3" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={uniqueData}
        keyExtractor={(item, index) => {
          if (item?.id !== undefined && item?.id !== null) {
            return `${title}-${item.id}`;
          }
          return `${title}-${index}`;
        }}
        renderItem={({ item }) => (
          <PlaylistCard 
            playlist={item} 
            onPress={() => handlePress && handlePress(item)} 
            showActions={false}
            coverOnly={coverOnly}
          />
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        // Virtual List 최적화
        windowSize={3}
        maxToRenderPerBatch={5}
        initialNumToRender={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 186,
          offset: 186 * index,
          index,
        })}
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
});

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