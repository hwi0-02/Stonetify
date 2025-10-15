import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { View, Text, TouchableOpacity } from 'react-native';
import PlaylistCard from '../playlists/PlaylistCard';
import { createStyles } from '../../utils/ui';
import { card as cardStyle, textVariants, pressableHitSlop } from '../../utils/uiComponents';

const styles = createStyles(({ colors, spacing, typography }) => ({
  container: {
    ...cardStyle({ padding: spacing.lg, interactive: false }),
    gap: spacing.sm,
  },
  header: {
    marginBottom: spacing.xs,
  },
  userName: {
    ...typography.subheading,
    fontSize: 16,
  },
  contentTitle: {
    ...typography.subheading,
    fontSize: 15,
  },
  contentDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    marginTop: spacing.sm,
  },
  likeButton: {
    ...textVariants.subtitle,
    color: colors.accent,
    fontWeight: '700',
  },
}));

const PostItem = ({ post, onLike, onPlaylistPress }) => {
  const { title, description } = useMemo(() => {
    const content = post?.content;
    if (!content) return { title: '', description: '' };
    if (typeof content === 'string') {
      return { title: '', description: content };
    }
    if (typeof content === 'object') {
      return {
        title: content.title || '',
        description: content.description || '',
      };
    }
    return { title: '', description: String(content) };
  }, [post?.content]);

  const likesCount = typeof post?.likesCount === 'number'
    ? post.likesCount
    : post?.postLikingUsers?.length || 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.userName}>{post?.user?.display_name || '알 수 없는 사용자'}</Text>
      </View>
      {title ? <Text style={styles.contentTitle}>{title}</Text> : null}
      {description ? <Text style={styles.contentDescription}>{description}</Text> : null}
      {post?.playlist ? (
        <PlaylistCard
          playlist={post.playlist}
          onPress={onPlaylistPress ? () => onPlaylistPress(post.playlist) : undefined}
          showActions={false}
        />
      ) : null}
      <View style={styles.footer}>
        <TouchableOpacity onPress={onLike} hitSlop={pressableHitSlop}>
          <Text style={styles.likeButton}>❤️ {likesCount.toLocaleString()} Likes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

PostItem.propTypes = {
  post: PropTypes.shape({
    content: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object,
    ]),
    likesCount: PropTypes.number,
    postLikingUsers: PropTypes.array,
    playlist: PropTypes.object,
    user: PropTypes.shape({
      display_name: PropTypes.string,
    }),
  }).isRequired,
  onLike: PropTypes.func,
  onPlaylistPress: PropTypes.func,
};

PostItem.defaultProps = {
  onLike: undefined,
  onPlaylistPress: undefined,
};

export default PostItem;