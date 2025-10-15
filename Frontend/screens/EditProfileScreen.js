import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { updateUserProfile } from '../store/slices/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { colors as palette, createStyles } from '../utils/ui';
import { textVariants, pressableHitSlop } from '../utils/uiComponents';

const placeholderProfile = require('../assets/images/placeholder_album.png');
const placeholderColor = palette.textMuted;

const EditProfileScreen = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { user, status } = useAppSelector((state) => state.auth);

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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerButton}
            hitSlop={pressableHitSlop}
          >
            <Text style={styles.headerButtonText}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프로필 수정</Text>
          <TouchableOpacity
            onPress={handleSaveChanges}
            style={styles.headerButton}
            hitSlop={pressableHitSlop}
          >
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
              <Ionicons name="camera" size={18} color={palette.textPrimary} />
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
            placeholderTextColor={placeholderColor}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
      </ScrollView>

      {status === 'loading' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    ...typography.subheading,
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  headerButtonText: {
    ...textVariants.subtitle,
    fontSize: 15,
    color: colors.textPrimary,
  },
  saveButton: {
    color: colors.accent,
    fontWeight: '700',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceMuted,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: spacing.xs,
    right: spacing.xs,
    backgroundColor: colors.overlay,
    padding: spacing.xs,
    borderRadius: radii.pill,
  },
  changePhotoText: {
    ...typography.subheading,
    fontSize: 15,
    color: colors.accent,
  },
  inputSection: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  label: {
    ...textVariants.subtitle,
    fontSize: 14,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));

export default EditProfileScreen;
