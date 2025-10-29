import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { updateUserProfile } from '../store/slices/authSlice';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const EditProfileScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { user, status } = useSelector((state) => state.auth);

  const [newDisplayName, setNewDisplayName] = useState('');
  const [newImageUri, setNewImageUri] = useState(null);
  const [newImageMimeType, setNewImageMimeType] = useState('image/jpeg');

  useEffect(() => {
    if (user?.display_name) {
      setNewDisplayName(user.display_name);
    }
  }, [user]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setNewImageUri(asset.uri);
      if (asset.mimeType && asset.mimeType.startsWith('image/')) {
        setNewImageMimeType(asset.mimeType);
      } else {
        setNewImageMimeType('image/jpeg');
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!newDisplayName.trim()) {
      Alert.alert('입력 필요', '닉네임을 입력해주세요.');
      return;
    }

    try {
      await dispatch(updateUserProfile({
        displayName: newDisplayName.trim(),
        imageUri: newImageUri,
        mimeType: newImageMimeType,
      })).unwrap();

      Alert.alert('완료', '프로필이 성공적으로 업데이트되었습니다.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('오류', typeof error === 'string' ? error : '프로필 업데이트 중 문제가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerButtonText}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필 수정</Text>
          <TouchableOpacity onPress={handleSaveChanges}>
            <Text style={[styles.headerButtonText, styles.saveButton]}>저장</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handlePickImage}>
            <Image
              source={newImageUri ? { uri: newImageUri } : (user?.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile)}
              style={styles.profileImage}
            />
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickImage}>
            <Text style={styles.changePhotoText}>프로필 사진 변경</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>닉네임</Text>
          <TextInput
            value={newDisplayName}
            onChangeText={setNewDisplayName}
            placeholder="새 닉네임을 입력하세요"
            placeholderTextColor="#555"
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
      </ScrollView>

      {status === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1DB954" />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    color: '#1DB954',
    fontWeight: 'bold',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#282828',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 18,
  },
  changePhotoText: {
    marginTop: 16,
    color: '#1DB954',
    fontSize: 16,
    fontWeight: '600',
  },
  inputSection: {
    paddingHorizontal: 24,
  },
  label: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#282828',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default EditProfileScreen;
