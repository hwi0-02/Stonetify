import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthButton from '../components/auth/AuthButton';

const CreatePlaylistScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleNext = () => {
    if (!title.trim()) {
      Alert.alert('오류', '플레이리스트 제목을 입력해주세요.');
      return;
    }
    navigation.navigate('Search', { isCreatingPlaylist: true, playlistTitle: title, playlistDescription: description });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>새 플레이리스트 만들기</Text>
        <View style={{width: 28}} />
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>제목</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="플레이리스트 제목"
          placeholderTextColor="#a7a7a7"
        />
        <Text style={styles.label}>설명 (선택)</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={description}
          onChangeText={setDescription}
          placeholder="플레이리스트에 대한 설명을 적어주세요."
          placeholderTextColor="#a7a7a7"
          multiline
        />
        <AuthButton title="다음" onPress={handleNext} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  form: {
    padding: 20,
    marginTop: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: '#fff',
  },
  textarea: {
      height: 100,
      textAlignVertical: 'top',
      paddingTop: 15,
  }
});

export default CreatePlaylistScreen;