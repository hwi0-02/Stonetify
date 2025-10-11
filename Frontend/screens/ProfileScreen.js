import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { getMe, logout } from '../store/slices/authSlice';
import { fetchMyPlaylists } from '../store/slices/playlistSlice';
import { fetchLikedSongs } from '../store/slices/likedSongsSlice'; // 변경
import { fetchRecentSongs } from '../store/slices/recentSongsSlice'; // 추가
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import { toggleLikedLocal, toggleLikeSongThunk } from '../store/slices/likedSongsSlice'; // 추가

const placeholderProfile = require('../assets/images/placeholder_album.png');

const ProfileScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { userPlaylists, status } = useSelector((state) => state.playlist);
    const likedSongs = useSelector((state) => state.likedSongs.list);
    const { recentSongs } = useSelector((state) => state.recentSongs); // 추가
    const likedPlaylists = useSelector(state => state.likedPlaylists.list); // 추가

    useEffect(() => {
        // 사용자 정보 및 플레이리스트 로드
        if (!user) {
            dispatch(getMe());
        }
        dispatch(fetchMyPlaylists());
        dispatch(fetchLikedSongs()); // 변경
        dispatch(fetchRecentSongs()); // 추가
    }, [dispatch]);

    if (!user) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#8A2BE2" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>프로필</Text>
                <TouchableOpacity onPress={() => dispatch(logout())} style={styles.logoutButton}>
                    <Ionicons name="log-out-outline" size={22} color="#b3b3b3" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
                <View style={styles.profileInfo}>
                    <View style={styles.profileImageContainer}>
                        <Image 
                            source={user.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile} 
                            style={styles.profileImage} 
                        />
                        <View style={styles.profileBadge}>
                            <Ionicons name="person" size={16} color="#1DB954" />
                        </View>
                    </View>
                    <Text style={styles.displayName}>{user.display_name}</Text>
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{userPlaylists.length}</Text>
                            <Text style={styles.statLabel}>플레이리스트</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>0</Text>
                            <Text style={styles.statLabel}>팔로잉</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity style={styles.primaryActionButton} onPress={() => navigation.navigate('CreatePlaylist')}>
                        <Ionicons name="add" size={20} color="#121212" />
                        <Text style={styles.primaryActionText}>새 플레이리스트</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.secondaryActionButton}>
                        <Ionicons name="shuffle" size={18} color="#ffffff" />
                        <Text style={styles.secondaryActionText}>셔플 재생</Text>
                    </TouchableOpacity>
                </View>

                <HorizontalPlaylist
                    title="나의 플레이리스트"
                    data={userPlaylists}
                    onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                />
                <HorizontalPlaylist
                    title="좋아요한 플레이리스트" // 수정
                    data={likedPlaylists}
                    onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                />
                <HorizontalPlaylist
                    title="최근에 본 플레이리스트"
                    data={recentSongs}
                    onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                />
                
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#121212' 
    },
    centered: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#121212' 
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: '#121212',
    },
    headerTitle: { 
        color: '#ffffff', 
        fontSize: 28, 
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    logoutButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInfo: { 
        alignItems: 'center', 
        paddingVertical: 32,
        paddingHorizontal: 16,
    },
    profileImageContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 12,
    },
    profileImage: { 
        width: 140, 
        height: 140, 
        borderRadius: 70,
    },
    profileBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#121212',
        borderWidth: 2,
        borderColor: '#1DB954',
        justifyContent: 'center',
        alignItems: 'center',
    },
    displayName: { 
        color: '#ffffff', 
        fontSize: 36, 
        fontWeight: '900',
        marginBottom: 20,
        letterSpacing: -1,
        textAlign: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        paddingVertical: 18,
        paddingHorizontal: 40,
        minWidth: 280,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
        minWidth: 100,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: '#404040',
        marginHorizontal: 24,
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
    actionButtonsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 32,
        gap: 12,
    },
    primaryActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1DB954',
        paddingVertical: 14,
        borderRadius: 28,
        shadowColor: '#1DB954',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    primaryActionText: {
        color: '#121212',
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    secondaryActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: '#404040',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 28,
    },
    secondaryActionText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    scrollViewContent: { 
        paddingBottom: 100,
        backgroundColor: '#121212',
    },
});

export default ProfileScreen;

const initialState = {
    likedTracks: [], // 반드시 배열로 초기화
    // ...other state...
};