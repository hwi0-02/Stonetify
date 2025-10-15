import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { FlatList, View } from 'react-native';
import PlaylistCard from './playlists/PlaylistCard';
import SectionHeader from './common/SectionHeader';
import EmptyState from './common/EmptyState';
import { createStyles } from '../utils/ui';

const styles = createStyles(({ spacing }) => ({
  container: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  emptyWrapper: {
    paddingHorizontal: spacing.md,
  },
}));

const HorizontalPlaylist = ({ title, data, onPlaylistPress, onItemPress, onSeeAll, coverOnly }) => {
  const handlePress = onItemPress || onPlaylistPress;

  const uniqueData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    const normalized = data.filter(Boolean);
    const deduped = [];
    const seen = new Set();
    normalized.forEach((item) => {
      const id = item?.id;
      if (id === undefined || id === null || !seen.has(id)) {
        if (id !== undefined && id !== null) seen.add(id);
        deduped.push(item);
      }
    });
    return deduped;
  }, [data]);

  return (
    <View style={styles.container}>
      <SectionHeader
        title={title}
        actionLabel={onSeeAll && uniqueData.length > 0 ? '모두 보기' : undefined}
        onPressAction={uniqueData.length > 0 ? onSeeAll : undefined}
      />
      <FlatList
        data={uniqueData}
        horizontal
        contentContainerStyle={styles.list}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => (item?.id ? `${title}-${item.id}` : `${title}-${index}`)}
        renderItem={({ item }) => (
          <PlaylistCard
            playlist={item}
            onPress={() => handlePress && handlePress(item)}
            showActions={false}
            coverOnly={coverOnly}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrapper}>
            <EmptyState
              title="아직 플레이리스트가 없습니다"
              description="좋아하는 음악으로 첫 플레이리스트를 만들어보세요"
            />
          </View>
        }
      />
    </View>
  );
};

HorizontalPlaylist.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.object),
  onPlaylistPress: PropTypes.func,
  onItemPress: PropTypes.func,
  onSeeAll: PropTypes.func,
  coverOnly: PropTypes.bool,
};

HorizontalPlaylist.defaultProps = {
  data: [],
  onPlaylistPress: undefined,
  onItemPress: undefined,
  onSeeAll: undefined,
  coverOnly: false,
};

export default HorizontalPlaylist;