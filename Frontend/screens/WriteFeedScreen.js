import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform, } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { fetchMyPlaylists } from '../store/slices/playlistSlice';
import { createPost, updatePost } from '../store/slices/postSlice';
import { useNavigation } from '@react-navigation/native';
import HorizontalPlaylist from '../components/HorizontalPlaylist';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const WriteFeedScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const { userPlaylists = [] } = useSelector((state) => state.playlist);
  
  // 수정 모드 
  const { post: postToEdit } = route.params || {}; // PostCard에서 전달받은 post 데이터
  const isEditMode = !!postToEdit; // post 데이터가 있으면 수정 모드

  // 입력 상태
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  
  // UI 상태
  const [isLoading, setIsLoading] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  
  // 유효성 검사 상태
  const [titleError, setTitleError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [playlistError, setPlaylistError] = useState('');

  useEffect(() => {
    dispatch(fetchMyPlaylists());
  if (isEditMode) {
        setTitle(postToEdit.content.title);
        setDescription(postToEdit.content.description);
        setSelectedPlaylist(postToEdit.playlist);
    }
  }, [dispatch, isEditMode, postToEdit]);

  // 입력 validation 함수들
  const validateTitle = (text) => {
    setTitle(text);
    if (text.length === 0) {
      setTitleError('');
    } else if (text.length > 50) {
      setTitleError('제목은 50자 이하로 입력해주세요.');
    } else {
      setTitleError('');
    }
  };

  const validateDescription = (text) => {
    setDescription(text);
    if (text.length > 200) {
      setDescriptionError('설명은 200자 이하로 입력해주세요.');
    } else {
      setDescriptionError('');
    }
  };

  // 플레이리스트 선택 처리
  const handlePlaylistSelect = (playlist) => {
    setSelectedPlaylist(playlist);
    setPlaylistError('');
    setShowPlaylistModal(false);
  };

  // 전체 validation 체크
  const validateForm = () => {
    let isValid = true;

    if (title.trim().length === 0) {
      setTitleError('제목을 입력해주세요.');
      isValid = false;
    } else if (title.length > 50) {
      setTitleError('제목은 50자 이하로 입력해주세요.');
      isValid = false;
    }

    if (description.length > 200) {
      setDescriptionError('설명은 200자 이하로 입력해주세요.');
      isValid = false;
    }

    if (!selectedPlaylist) {
      setPlaylistError('플레이리스트를 선택해주세요.');
      isValid = false;
    }

    return isValid;
  };

  // 등록 버튼 처리
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsLoading(true);

    try {
        const postData = {
            playlist_id: selectedPlaylist.id,
            content: JSON.stringify({
                title: title.trim(),
                description: description.trim()
            })
        };
      
       if (isEditMode) {
            // 수정 모드일 경우 updatePost 액션을 디스패치합니다.
            await dispatch(updatePost({ postId: postToEdit.id, postData })).unwrap();
            Alert.alert('성공', '피드가 성공적으로 수정되었습니다.');
        } else {
            // 생성 모드일 경우 createPost 액션을 디스패치합니다.
            await dispatch(createPost(postData)).unwrap();
            Alert.alert('성공', '피드가 성공적으로 등록되었습니다.');
        }
      navigation.goBack();


    } catch (error) {
        const errorMessage = error.message || '오류가 발생했습니다.';
        Alert.alert(isEditMode ? '수정 실패' : '등록 실패', errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  
  // 플레이리스트 아이템 렌더링
  const renderPlaylistItem = ({ item }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => handlePlaylistSelect(item)}
    >
      <Image source={{ uri: item.coverUrl }} style={styles.playlistCover} resizeMode="cover" />
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistTitle}>{item.title}</Text>
        <Text style={styles.playlistMeta}>
          {item.description} • {item.songCount}곡
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? '피드 수정' : '피드 작성'}</Text>
        <TouchableOpacity onPress={handleSubmit}
          disabled={isLoading || !title.trim() || !selectedPlaylist}
          style={[
            styles.submitButton,
            (!title.trim() || !selectedPlaylist) && styles.submitButtonDisabled
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>{isEditMode ? '수정' : '등록'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 제목 입력 */}
        <View style={styles.section}>
          <Text style={styles.label}>제목</Text>
          <TextInput
            style={[styles.titleInput, titleError && styles.inputError]}
            value={title}
            onChangeText={validateTitle}
            placeholder="제목을 입력하세요"
            placeholderTextColor="#b3b3b3"
            maxLength={50}
          />
          <View style={styles.inputMeta}>
            {titleError ? (
              <Text style={styles.errorText}>{titleError}</Text>
            ) : null}
            <Text style={styles.charCount}>{title.length}/50</Text>
          </View>
        </View>

        {/* 설명 입력 */}
        <View style={styles.section}>
          <Text style={styles.label}>설명 (선택사항)</Text>
          <TextInput
            style={[styles.descriptionInput, descriptionError && styles.inputError]}
            value={description}
            onChangeText={validateDescription}
            placeholder="플레이리스트를 자유롭게 소개해보세요"
            placeholderTextColor="#b3b3b3"
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          <View style={styles.inputMeta}>
            {descriptionError ? (
              <Text style={styles.errorText}>{descriptionError}</Text>
            ) : null}
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>
        </View>

        {/* 플레이리스트 선택 */}
        <View style={styles.section}>
          <Text style={styles.label}>플레이리스트</Text>
          
          {!selectedPlaylist ? (
            <TouchableOpacity
              style={[styles.selectButton, playlistError && styles.inputError]}
              onPress={() => setShowPlaylistModal(true)}
            >
              <Ionicons name="add" size={20} color="#1DB954" />
              <Text style={styles.selectButtonText}>플레이리스트 선택하기</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.selectedPlaylist}
              onPress={() => setShowPlaylistModal(true)}
            >
              <HorizontalPlaylist
                  data={[selectedPlaylist]} // 선택된 플레이리스트만 표시
                  onItemPress={() => setShowPlaylistModal(true)}
                  coverOnly={true}
                />
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedTitle}>{selectedPlaylist.title}</Text>
                <Text style={styles.selectedMeta}>
                  {selectedPlaylist.description}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          
          {playlistError ? (
            <Text style={styles.errorText}>{playlistError}</Text>
          ) : null}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* 플레이리스트 선택 모달 */}
      <Modal
        visible={showPlaylistModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPlaylistModal(false)}>
              <Text style={styles.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>플레이리스트 선택</Text>
            <View style={styles.modalSpacer} />
          </View>
        <HorizontalPlaylist
         data={userPlaylists}
         onItemPress={(item) => {
        handlePlaylistSelect(item);
        setShowPlaylistModal(false);
      }}
      onSeeAll={null}
    />

        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
// ... (스타일 코드는 이전과 동일)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1DB954',
    borderRadius: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#404040',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#888888',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#181818',
    color: '#ffffff',
    fontSize: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282828',
  },
  descriptionInput: {
    backgroundColor: '#181818',
    color: '#ffffff',
    fontSize: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282828',
    height: 120,
  },
  inputError: {
    borderColor: '#e22134',
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    color: '#e22134',
    fontSize: 12,
  },
  charCount: {
    color: '#b3b3b3',
    fontSize: 12,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181818',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282828',
    borderStyle: 'dashed',
  },
  selectButtonText: {
    color: '#1DB954',
    fontSize: 16,
    marginLeft: 8,
  },
  selectedPlaylist: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282828',
  },
  selectedCover: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  selectedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectedMeta: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 4,
  },
  bottomSpacing: {
    height: 40,
  },
  // 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  modalCancel: {
    color: '#ffffff',
    fontSize: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalSpacer: {
    width: 40,
  },
  modalContent: {
    padding: 16,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#181818',
    borderRadius: 8,
  },
  playlistCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#333',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  playlistMeta: {
    color: '#b3b3b3',
    fontSize: 14,
    marginTop: 2,
  },
});


export default WriteFeedScreen;