import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import PlaylistCard from '../playlists/PlaylistCard'; // Post에 포함된 플레이리스트를 보여주기 위해 재사용

// 홈 화면 피드에 표시될 개별 포스트 컴포넌트
const PostItem = ({ post, onLike, onPlaylistPress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.userName}>{post.user?.display_name || 'Unknown User'}</Text>
      </View>
      <Text style={styles.content}>{post.content}</Text>
      {post.playlist && (
         <PlaylistCard playlist={post.playlist} onPress={() => onPlaylistPress(post.playlist.id)} />
      )}
      <View style={styles.footer}>
        <TouchableOpacity onPress={onLike}>
          {/* 좋아요 여부에 따라 아이콘 변경 로직 추가 필요 */}
          <Text style={styles.likeButton}>❤️ {post.postLikingUsers?.length || 0} Likes</Text>
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
  content: {
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
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