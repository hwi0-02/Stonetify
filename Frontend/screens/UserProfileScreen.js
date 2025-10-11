import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import apiService from '../services/apiService';
import HorizontalPlaylist from '../components/HorizontalPlaylist';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const UserProfileScreen = ({ route }) => {
    const { userId } = route.params;
    const navigation = useNavigation(); // useNavigation 훅 사용
    const { user: loggedInUser } = useSelector(state => state.auth);

    const [profileData, setProfileData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const isMyProfile = userId === loggedInUser?.id;

    // 만약 내 프로필을 보려고 하면, 기존 프로필 탭으로 보내줍니다.
   useEffect(() => {
        if (isMyProfile) {
            // 내 프로필인 경우, UserProfileScreen을 스택에서 제거하고 Profile 탭으로 이동
            navigation.replace('Main', { screen: 'Profile' });
        }
    }, [isMyProfile, navigation]);

    // ❗ --- 수정된 부분: useFocusEffect 사용 방식 변경 --- ❗
    useFocusEffect(
        useCallback(() => {
            // async 함수를 effect 내에서 정의하고 호출합니다.
            const fetchData = async () => {
                if (!userId || isMyProfile) {
                    setIsLoading(false);
                    return;
                }
                setIsLoading(true);
                try {
                    const data = await apiService.getUserProfile(userId);
                    setProfileData(data);
                } catch (error) {
                    Alert.alert('오류', '프로필 정보를 불러오는 데 실패했습니다.');
                } finally {
                    setIsLoading(false);
                }
            };

            fetchData();
        }, [userId, isMyProfile])
    );

    const handleToggleFollow = async () => {
        if (!loggedInUser) return Alert.alert('로그인이 필요한 기능입니다.');
        try {
            const result = await apiService.toggleFollow(userId);
            setProfileData(prev => ({
                ...prev,
                isFollowing: result.isFollowing,
                stats: { ...prev.stats, followers: result.followersCount }
            }));
        } catch (error) {
            Alert.alert('오류', '팔로우 처리에 실패했습니다.');
        }
    };

     // 내 프로필이거나, 로딩 중이거나, 데이터가 없으면 로딩 화면을 보여줍니다.
    if (isMyProfile || isLoading || !profileData?.user) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#1DB954" /></View>;
    }

    const { user, playlists, stats, isFollowing } = profileData;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>프로필</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <View style={styles.profileInfo}>
                    <Image 
                        source={user.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile} 
                        style={styles.profileImage} 
                    />
                    <Text style={styles.displayName}>{user.display_name}</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{playlists.length}</Text>
                            <Text style={styles.statLabel}>플레이리스트</Text>
                            </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.followers}</Text>
                            <Text style={styles.statLabel}>팔로워</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{stats.following}</Text>
                            <Text style={styles.statLabel}>팔로잉</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity 
                        style={isFollowing ? styles.secondaryActionButton : styles.primaryActionButton} 
                        onPress={handleToggleFollow}
                    >
                        <Ionicons name={isFollowing ? "checkmark" : "person-add-outline"} size={20} color={isFollowing ? "#ffffff" : "#121212"} />
                        <Text style={isFollowing ? styles.secondaryActionText : styles.primaryActionText}>
                            {isFollowing ? '팔로잉' : '팔로우'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <HorizontalPlaylist
                    title={`${user.display_name}의 플레이리스트`}
                    data={playlists}
                    onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                />
            </ScrollView>
        </View>
    );
};

// ProfileScreen.js와 동일한 스타일을 사용합니다.
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#121212',
    },
    backButton: { padding: 5 },
    headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
    profileInfo: { alignItems: 'center', paddingVertical: 20 },
    profileImage: { width: 120, height: 120, borderRadius: 60, marginBottom: 16 },
    displayName: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
    statsContainer: { 
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        paddingVertical: 18,
        paddingHorizontal: 0,
    },
    statItem: {
        alignItems: 'center',
        flex: 0,
        minWidth: 90,
    },
    statNumber: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 6,
    },
    statLabel: {
        color: '#b3b3b3',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        textAlign: 'center',
        lineHeight: 16,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#404040',
        marginHorizontal: 30,
    },
    actionButtonsContainer: { paddingHorizontal: 20, marginVertical: 20, marginTop: 10 },
    primaryActionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1DB954', paddingVertical: 14, borderRadius: 28 },
    primaryActionText: { color: '#121212', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    secondaryActionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#282828', paddingVertical: 14, borderRadius: 28 },
    secondaryActionText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    scrollViewContent: { paddingBottom: 100 },
});

export default UserProfileScreen;