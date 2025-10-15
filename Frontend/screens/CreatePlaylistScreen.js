import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthButton from '../components/auth/AuthButton';
import { createStyles } from '../utils/ui';
import { textVariants, pressableHitSlop } from '../utils/uiComponents';

const CreatePlaylistScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleNext = () => {
    if (!title.trim()) {
      Alert.alert('오류', '플레이리스트 제목을 입력해주세요.');
      return;
    }
    // 제목과 설명 정보를 가지고 SearchScreen으로 이동
    navigation.navigate('Search', { isCreatingPlaylist: true, playlistTitle: title, playlistDescription: description });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="close" size={24} color={styles.iconColor.color} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새 플레이리스트 만들기</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>제목</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="플레이리스트 제목"
          placeholderTextColor={styles.placeholder.color}
        />
        <Text style={styles.label}>설명 (선택)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="플레이리스트에 대한 설명을 적어주세요."
          placeholderTextColor={styles.placeholder.color}
          multiline
        />
        <AuthButton title="다음" onPress={handleNext} />
      </View>
    </View>
  );
};

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    ...typography.subheading,
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  iconColor: {
    color: colors.textPrimary,
  },
  form: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  label: {
    ...textVariants.subtitle,
    fontSize: 15,
  },
  input: {
    width: '100%',
    minHeight: 52,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 16,
  },
  textarea: {
    minHeight: 110,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  placeholder: {
    color: colors.textMuted,
  },
}));

export default CreatePlaylistScreen;