import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PlaylistCard from '../playlists/PlaylistCard'; // Post에 포함된 플레이리스트를 보여주기 위해 재사용

// 홈 화면 피드에 표시될 개별 포스트 컴포넌트
const PostItem = ({ post, onLike, onPlaylistPress }) => {
  const content = post?.content;
  let contentTitle = '';
  let contentDescription = '';

  if (typeof content === 'string') {
    contentDescription = content;
  } else if (content && typeof content === 'object') {
    contentTitle = content.title || '';
    contentDescription = content.description || '';
  }

  const likesCount = typeof post?.likesCount === 'number'
    ? post.likesCount
    : post?.postLikingUsers?.length || 0;

  const handlePlaylistPress = () => {
    if (post?.playlist && onPlaylistPress) {
      onPlaylistPress(post.playlist);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.userName}>{post?.user?.display_name || 'Unknown User'}</Text>
      </View>
      {contentTitle ? <Text style={styles.contentTitle}>{contentTitle}</Text> : null}
      {contentDescription ? (
        <Text style={styles.contentDescription}>{contentDescription}</Text>
      ) : null}
      {!contentTitle && !contentDescription && content ? (
        <Text style={styles.contentDescription}>{String(content)}</Text>
      ) : null}
      {post?.playlist ? (
        <PlaylistCard
          playlist={post.playlist}
          onPress={handlePlaylistPress}
          showActions={false}
        />
      ) : null}
      <View style={styles.footer}>
        <TouchableOpacity onPress={onLike}>
          {/* 좋아요 여부에 따라 아이콘 변경 로직 추가 필요 */}
          <Text style={styles.likeButton}>❤️ {likesCount} Likes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  header: {
    marginBottom: 10,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  contentTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    color: '#121212',
  },
  contentDescription: {
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
    color: '#333333',
  },
  footer: {
    marginTop: 10,
  },
  likeButton: {
    color: '#1DB954',
    fontWeight: 'bold',
  }
});

export default PostItem;