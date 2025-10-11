import React, { useState, useEffect } from 'react';
// 👇 [수정됨] Alert와 ScrollView를 import에 추가합니다.
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { updateUserProfile, deleteUserAccount } from '../store/slices/authSlice';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const EditProfileScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { user, status } = useSelector((state) => state.auth);

    const [newImageUri, setNewImageUri] = useState(null);
    const [newDisplayName, setNewDisplayName] = useState(user?.display_name || '');

    useEffect(() => {
        if (user) {
            setNewDisplayName(user.display_name);
        }
    }, [user]);

    const handlePickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            alert("갤러리 접근 권한이 필요합니다.");
            return;
        }

        const pickerResult = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!pickerResult.canceled) {
            setNewImageUri(pickerResult.assets[0].uri);
        }
    };

    const handleSaveChanges = async () => {
        if (!newDisplayName.trim()) {
            alert("닉네임을 입력해주세요.");
            return;
        }

        const profileData = {
            displayName: newDisplayName,
            imageUri: newImageUri,
        };

        try {
            await dispatch(updateUserProfile(profileData)).unwrap();
            alert("프로필이 성공적으로 업데이트 되었습니다!");
            navigation.goBack();
        } catch (error) {
            console.error("프로필 업데이트 실패(UI):", error);
            alert(`업데이트 중 오류가 발생했습니다: ${error}`);
        }
    };

    const handleDeleteAccount = () => {
    console.log('계정 삭제 버튼 클릭됨!');
    
    Alert.alert(
        "정말로 계정을 삭제하시겠습니까?",
        "이 작업은 되돌릴 수 없으며...",
        [
            { text: "취소", style: "cancel" },
            { 
                text: "계정 삭제", 
                style: "destructive",
                onPress: async () => {
                    try {
                        await dispatch(deleteUserAccount()).unwrap();
                    } catch (error) {
                        Alert.alert('오류', error || '계정 삭제 중 오류가 발생했습니다.');
                    }
                }
            }
        ]
    );
};

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.contentContainer}>
                {/* 헤더 */}
                <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.headerButtonText}>돌아가기</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>프로필 수정</Text>
                <TouchableOpacity onPress={handleSaveChanges}>
                    <Text style={[styles.headerButtonText, styles.saveButton]}>저장</Text>
                </TouchableOpacity>
            </View>

                {/* 프로필 사진 변경 */}
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

                {/* 닉네임 변경 */}
                <View style={styles.inputSection}>
                    <Text style={styles.label}>닉네임</Text>
                    <TextInput
                        style={styles.input}
                        value={newDisplayName}
                        onChangeText={setNewDisplayName}
                        placeholder="새 닉네임을 입력하세요"
                        placeholderTextColor="#555"
                    />
                </View>

                {/* 계정 삭제 섹션 */}
                <View style={styles.deleteSection}>
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                        <Ionicons name="trash-outline" size={20} color="#ff4d4d" />
                        <Text style={styles.deleteButtonText}>계정 삭제</Text>
                    </TouchableOpacity>
                </View>
                </ScrollView>
            {status === 'loading' && <ActivityIndicator style={StyleSheet.absoluteFill} size="large" />}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingTop:40,
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
    contentContainer: {
        paddingBottom: 50,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    profileImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#282828',
    },
    cameraIconContainer: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 20,
    },
    changePhotoText: {
        color: '#1DB954',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
    },
    inputSection: {
        paddingHorizontal: 24,
    },
    label: {
        color: '#aaa',
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
    deleteSection: {
        marginTop: 40,
        paddingHorizontal: 24,
        borderTopWidth: 1,
        borderTopColor: '#282828',
        paddingTop: 20,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 77, 77, 0.1)',
    },
    deleteButtonText: {
        color: '#ff4d4d',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default EditProfileScreen;