import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import { fetchMyPlaylists } from '../store/slices/playlistSlice';
import { createPost, updatePost } from '../store/slices/postSlice';

const WriteFeedScreen = ({ route, navigation }) => {
  const dispatch = useDispatch();
  const { userPlaylists = [] } = useSelector((state) => state.playlist);
  const { post: postToEdit } = route.params || {};
  const isEditMode = Boolean(postToEdit);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleError, setTitleError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [playlistError, setPlaylistError] = useState('');
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);

  useEffect(() => {
    dispatch(fetchMyPlaylists());
  }, [dispatch]);

  useEffect(() => {
    if (!isEditMode || !postToEdit) return;
    const content = postToEdit.content || {};
    setTitle(content.title || '');
    setDescription(content.description || '');
    if (postToEdit.playlist) {
      setSelectedPlaylist(postToEdit.playlist);
    }
  }, [isEditMode, postToEdit]);

  const validateTitle = useCallback((text) => {
    setTitle(text);
    if (!text.trim()) {
      setTitleError('');
      return;
    }
    if (text.length > 50) {
      setTitleError('제목은 50자 이하로 입력해주세요.');
    } else {
      setTitleError('');
    }
  }, []);

  const validateDescription = useCallback((text) => {
    setDescription(text);
    if (text.length > 200) {
      setDescriptionError('설명은 200자 이하로 입력해주세요.');
    } else {
      setDescriptionError('');
    }
  }, []);

  const handlePlaylistSelect = (playlist) => {
    setSelectedPlaylist(playlist);
    setPlaylistError('');
    setPlaylistModalVisible(false);
  };

  const validateForm = () => {
    let hasError = false;

    if (!title.trim()) {
      setTitleError('제목을 입력해주세요.');
      hasError = true;
    }

    if (title.trim().length > 50) {
      setTitleError('제목은 50자 이하로 입력해주세요.');
      hasError = true;
    }

    if (description.length > 200) {
      setDescriptionError('설명은 200자 이하로 입력해주세요.');
      hasError = true;
    }

    if (!selectedPlaylist) {
      setPlaylistError('플레이리스트를 선택해주세요.');
      hasError = true;
    }

    return !hasError;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedPlaylist) return;
    setIsSubmitting(true);

    try {
      const payload = {
        playlist_id: selectedPlaylist.id,
        content: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      };

      if (isEditMode) {
        await dispatch(updatePost({ postId: postToEdit.id, postData: payload })).unwrap();
        Alert.alert('완료', '피드를 수정했습니다.');
      } else {
        await dispatch(createPost(payload)).unwrap();
        Alert.alert('완료', '피드를 등록했습니다.');
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('오류', error?.message || '피드 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = !title.trim() || !selectedPlaylist || isSubmitting;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? '피드 수정' : '피드 작성'}</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitDisabled}
          style={[styles.submitButton, isSubmitDisabled && styles.submitButtonDisabled]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>{isEditMode ? '수정' : '등록'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
            {titleError ? <Text style={styles.errorText}>{titleError}</Text> : <View />}
            <Text style={styles.charCount}>{title.length}/50</Text>
          </View>
        </View>

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
            {descriptionError ? <Text style={styles.errorText}>{descriptionError}</Text> : <View />}
            <Text style={styles.charCount}>{description.length}/200</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>플레이리스트</Text>
          {!selectedPlaylist ? (
            <TouchableOpacity
              style={[styles.selectButton, playlistError && styles.inputError]}
              onPress={() => setPlaylistModalVisible(true)}
            >
              <Ionicons name="add" size={20} color="#1DB954" />
              <Text style={styles.selectButtonText}>플레이리스트 선택하기</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.selectedPlaylist}
              onPress={() => setPlaylistModalVisible(true)}
            >
              <HorizontalPlaylist
                data={[selectedPlaylist]}
                onItemPress={() => setPlaylistModalVisible(true)}
                coverOnly
              />
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedTitle}>{selectedPlaylist.title}</Text>
                {selectedPlaylist.description ? (
                  <Text style={styles.selectedMeta}>{selectedPlaylist.description}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
          {playlistError ? <Text style={styles.errorText}>{playlistError}</Text> : null}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Modal
        visible={playlistModalVisible}
        animationType="slide"
        onRequestClose={() => setPlaylistModalVisible(false)}
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPlaylistModalVisible(false)}>
              <Text style={styles.modalCancel}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>플레이리스트 선택</Text>
            <View style={styles.modalSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <HorizontalPlaylist
              title={null}
              data={userPlaylists}
              onItemPress={(item) => handlePlaylistSelect(item)}
              coverOnly
            />
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
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
  headerTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  submitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1DB954',
    borderRadius: 20,
  },
  submitButtonDisabled: { backgroundColor: '#404040' },
  submitButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  label: { color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
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
    minHeight: 120,
  },
  inputError: { borderColor: '#e22134' },
  inputMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  errorText: { color: '#e22134', fontSize: 12 },
  charCount: { color: '#b3b3b3', fontSize: 12 },
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
  selectButtonText: { color: '#1DB954', fontSize: 16, marginLeft: 8 },
  selectedPlaylist: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181818',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282828',
  },
  selectedInfo: { flex: 1, marginLeft: 16 },
  selectedTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  selectedMeta: { color: '#b3b3b3', fontSize: 14, marginTop: 4 },
  bottomSpacing: { height: 40 },
  modalContainer: { flex: 1, backgroundColor: '#121212' },
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
  modalCancel: { color: '#ffffff', fontSize: 16 },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  modalSpacer: { width: 40 },
  modalContent: { paddingVertical: 24 },
});

export default WriteFeedScreen;
