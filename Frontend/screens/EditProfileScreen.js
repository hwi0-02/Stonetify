import React, { useEffect, useState, useMemo } from 'react';
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
import { updateUserProfile, getMe, deleteAccount } from '../store/slices/authSlice';
import * as FileSystem from 'expo-file-system';
import { showToast } from '../utils/toast';

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

    // 변경 사항이 있는지 확인하는 상태
    const isChanged = useMemo(() => {
      if (!user) return false;
      const nameChanged = newDisplayName.trim() !== (user.display_name || '');
      const imageChanged = newImageUri !== null;
      return nameChanged || imageChanged;
    }, [user, newDisplayName, newImageUri]);

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
      quality: 0.7,
      base64: false,
    });

// 사용자가 선택을 취소한 경우 처리
    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log('Image selection cancelled');
      return;
    }

    const image = result.assets[0];
    setNewImageUri(image.uri);
    setNewImageMimeType(image.mimeType || 'image/jpeg');
  };

  const handleSave = async () => {
    if (!newDisplayName.trim()) {
      Alert.alert('오류', '이름을 입력해주세요.');
      return;
    }

    if (status === 'loading' || !isChanged) return;

    const profileData = {
      displayName: newDisplayName.trim(),
    };

    if (newImageUri) {
      try {
        const base64Encoding =
          FileSystem.EncodingType && FileSystem.EncodingType.Base64
            ? FileSystem.EncodingType.Base64
            : 'base64';

        const base64 = await FileSystem.readAsStringAsync(newImageUri, {
          encoding: base64Encoding,
        });

        profileData.base64Image = base64;
        profileData.mimeType = newImageMimeType;
      } catch (e) {
        console.error("Image to base64 conversion failed", e);
        Alert.alert('오류', '이미지를 처리하는 중 오류가 발생했습니다.');
        return;
      }
    }

    dispatch(updateUserProfile(profileData))
      .unwrap()
      .then(async (updatedUser) => {
        showToast('프로필이 성공적으로 저장되었습니다.');
        await dispatch(getMe());
        navigation.goBack();
      })
      .catch((error) => {
        Alert.alert('저장 실패', error || '프로필 저장 중 오류가 발생했습니다.');
      });
  };

  // 계정 삭제 버튼 핸들러 
  const handleDeleteAccount = () => {
    Alert.alert(
      "계정 삭제",
      "정말로 계정을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        { 
          text: "삭제", 
          style: "destructive", 
          onPress: () => {
            // deleteAccount Thunk 디스패치
            dispatch(deleteAccount())
              .unwrap() // 비동기 작업 완료 대기
              .then(() => {
                // 성공 시 (authSlice에서 이미 로그아웃 처리됨)
                showToast("계정이 성공적으로 삭제되었습니다.");
                // AppNavigator가 자동으로 Auth 화면으로 전환
              })
              .catch((error) => {
                // 실패 시 에러 알림
                Alert.alert("삭제 실패", error || "계정 삭제 중 오류가 발생했습니다.");
              });
          }
        }
      ]
    );
  };

  const isLoading = status === 'loading';
  const canSave = isChanged && !isLoading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필 편집</Text>
        <TouchableOpacity onPress={handleSave} disabled={!canSave}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#b04ad8ff" />
          ) : (
            <Text style={[styles.headerButtonText, canSave ? styles.saveButtonActive : styles.saveButtonDisabled]}>
              저장
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        scrollEnabled={!isLoading} 
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handlePickImage} disabled={isLoading}>
            <Image
              source={newImageUri ? { uri: newImageUri } : (user?.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile)}
              style={styles.profileImage}
            />
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickImage} disabled={isLoading}>
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
            editable={!isLoading}
          />
        </View>

        <View style={styles.dangerZone}>
          {/* 15. 계정 삭제 버튼 핸들러 연결 */}
          <TouchableOpacity onPress={handleDeleteAccount} disabled={isLoading}>
            <Text style={styles.deleteButtonText}>계정 삭제</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {status === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#b04ad8ff" />
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
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  headerTitle: {
    color: '#ffffff', 
    fontSize: 18, 
    fontWeight: '600' ,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    paddingTop: 52,
    paddingVertical: 8,
  },
  backButton: {
    zIndex: 1, 
  },
  headerButtonText: {
     color: '#ffffff', fontSize: 14, fontWeight: '600',
  },
  saveButtonActive: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: '#b04ad8ff',
    borderRadius: 20,
    fontSize: 15,
    overflow: 'hidden',
    zIndex: 1,
  },
  saveButtonDisabled: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    color: '#6a6a6a', 
    fontSize: 15,
    fontWeight: '600',
    zIndex: 1,
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
  dangerZone: {
    marginTop: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#888',
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
