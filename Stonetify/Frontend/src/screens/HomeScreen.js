import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    FlatList, 
    ActivityIndicator, 
    SafeAreaView,
    TextInput,
    TouchableOpacity,
    Alert 
} from 'react-native';
// ApiService에서 getFeed와 createPost 함수를 가져옵니다.
import { getFeed, createPost } from '../api/ApiService';

const HomeScreen = () => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  // 새 게시물 내용을 위한 state 추가
  const [newPostContent, setNewPostContent] = useState('');

  // 피드를 불러오는 함수
  const fetchFeed = async () => {
    try {
      const response = await getFeed();
      // API 응답 구조에 맞게 데이터 설정
      setFeed(response.data.data || response.data); 
    } catch (error) {
      console.error("피드 불러오기 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  // 새 게시물 작성 핸들러
  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      Alert.alert("오류", "내용을 입력해주세요.");
      return;
    }
    try {
      // API를 호출하여 새 게시물 생성
      await createPost({ content: newPostContent });
      setNewPostContent(''); // 입력창 비우기
      fetchFeed(); // 피드 새로고침
    } catch (error) {
      console.error("게시물 작성 실패:", error);
      Alert.alert("오류", "게시물 작성에 실패했습니다.");
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1DB954" /></View>;
  }
  
  // 게시물 아이템 컴포넌트
  const PostItem = ({ item }) => (
    <View style={styles.postContainer}>
      <Text style={styles.displayName}>{item.display_name}</Text>
      {item.playlist_title && (
        <Text style={styles.postContent}>플레이리스트 '{item.playlist_title}'를 공유했습니다.</Text>
      )}
      <Text style={styles.postContent}>{item.content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>피드</Text>
      
      {/* --- 게시물 작성 UI 시작 --- */}
      <View style={styles.createPostContainer}>
        <TextInput
          style={styles.input}
          placeholder="무슨 일이 있었나요?"
          placeholderTextColor="#B3B3B3"
          value={newPostContent}
          onChangeText={setNewPostContent}
        />
        <TouchableOpacity style={styles.postButton} onPress={handleCreatePost}>
          <Text style={styles.postButtonText}>게시</Text>
        </TouchableOpacity>
      </View>
      {/* --- 게시물 작성 UI 끝 --- */}

      <FlatList
        data={feed}
        renderItem={PostItem}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        ListEmptyComponent={<Text style={styles.emptyText}>표시할 피드가 없습니다.</Text>}
      />
    </SafeAreaView>
  );
};

// 기존 스타일은 유지하고, 새 UI를 위한 스타일만 추가합니다.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 32, fontWeight: 'bold', color: 'white', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  
  // --- 게시물 작성 UI 스타일 시작 ---
  createPostContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#282828',
    color: 'white',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 10,
  },
  postButton: {
    backgroundColor: '#1DB954',
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  postButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // --- 게시물 작성 UI 스타일 끝 ---

  postContainer: { backgroundColor: '#282828', borderRadius: 8, padding: 15, marginHorizontal: 20, marginBottom: 15, },
  displayName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  postContent: { color: '#B3B3B3', marginTop: 5 },
  emptyText: { color: '#B3B3B3', textAlign: 'center', marginTop: 50 },
});

export default HomeScreen;