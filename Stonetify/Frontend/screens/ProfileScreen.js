import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { getMe, logout } from '../store/slices/authSlice';
import { fetchUserPlaylists } from '../store/slices/playlistSlice';
import HorizontalPlaylist from '../components/HorizontalPlaylist';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const ProfileScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { userPlaylists, status } = useSelector((state) => state.playlist);

    useEffect(() => {
        if (!user) {
            dispatch(getMe());
        }
        if (user && user.id) {
            dispatch(fetchUserPlaylists(user.id));
        }
    }, [dispatch, user]);

    if (!user) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#8A2BE2" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={() => dispatch(logout())}>
                    <Ionicons name="log-out-outline" size={26} color="#a7a7a7" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <View style={styles.profileInfo}>
                    <Image source={user.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile} style={styles.profileImage} />
                    <Text style={styles.displayName}>{user.display_name}</Text>
                </View>

                {/* ❗ 새 플레이리스트 만들기 버튼 추가 */}
                <TouchableOpacity style={styles.createPlaylistButton} onPress={() => navigation.navigate('CreatePlaylist')}>
                    <Ionicons name="add" size={24} color="#fff" />
                    <Text style={styles.createPlaylistText}>새 플레이리스트 만들기</Text>
                </TouchableOpacity>

                <HorizontalPlaylist
                    title="나의 플레이리스트"
                    data={userPlaylists}
                    onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                />
                
                {/* Liked & Followed sections can be added here */}
                
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000'},
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
    },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    profileInfo: { alignItems: 'center', marginVertical: 20 },
    profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
    displayName: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    scrollViewContent: { paddingHorizontal: 15, paddingBottom: 80 },
    createPlaylistButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#282828',
        padding: 15,
        borderRadius: 8,
        marginBottom: 30,
    },
    createPlaylistText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});

export default ProfileScreen;