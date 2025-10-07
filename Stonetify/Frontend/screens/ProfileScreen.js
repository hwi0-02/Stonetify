import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { getMe, logout } from '../store/slices/authSlice';
import { fetchMyPlaylists } from '../store/slices/playlistSlice';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { showToast } from '../utils/toast';
import { exchangeSpotifyCode, getPremiumStatus, fetchSpotifyProfile } from '../store/slices/spotifySlice';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const ProfileScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const { userPlaylists, status } = useSelector((state) => state.playlist);
    const spotify = useSelector((state) => state.spotify);

    useEffect(() => {
        // 사용자 정보 및 플레이리스트 로드
        if (!user) {
            dispatch(getMe());
        }
        dispatch(fetchMyPlaylists());
    }, [dispatch]);

    if (!user) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#8A2BE2" /></View>;
    }

        const handleConnectSpotify = async () => {
            try {
                const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
                    || process.env.SPOTIFY_CLIENT_ID
                    || Constants.expoConfig?.extra?.spotifyClientId
                    || Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
                const inExpoGo = Constants.appOwnership === 'expo';
                const redirectUri = AuthSession.makeRedirectUri({ useProxy: inExpoGo, scheme: 'stonetify' });
                console.log('[SpotifyAuth] inExpoGo:', inExpoGo, 'redirectUri:', redirectUri);
                const scopes = [
                    'user-read-playback-state',
                    'user-modify-playback-state',
                    'user-read-currently-playing',
                    'streaming'
                ];
                if (!clientId) {
                    showToast('Spotify Client ID가 설정되지 않았습니다. EXPO_PUBLIC_SPOTIFY_CLIENT_ID를 설정해 주세요.');
                    return;
                }
                const discovery = {
                    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
                    tokenEndpoint: 'https://accounts.spotify.com/api/token',
                };
                const request = new AuthSession.AuthRequest({
                    clientId,
                    redirectUri,
                    scopes,
                    usePKCE: true,
                    responseType: AuthSession.ResponseType.Code,
                });
                await request.makeAuthUrlAsync(discovery);
                console.log('[SpotifyAuth] authUrl ready with redirectUri:', redirectUri);
                const res = await request.promptAsync(discovery, { useProxy: inExpoGo });
                if (res.type === 'success' && res.params?.code) {
                    const codeVerifier = request.codeVerifier;
                    await dispatch(exchangeSpotifyCode({ code: res.params.code, code_verifier: codeVerifier, redirect_uri: redirectUri, userId: user.id || user.userId })).unwrap();
                    await dispatch(getPremiumStatus());
                    await dispatch(fetchSpotifyProfile());
                } else if (res.type === 'dismiss' || res.type === 'cancel') {
                    showToast('Spotify 연결이 취소되었습니다.');
                } else if (res.type === 'error' || res.params?.error) {
                    const msg = res.params?.error_description || res.params?.error || '알 수 없는 오류';
                    if (msg.includes('redirect_uri')) {
                        showToast('Redirect URI 불일치입니다. Spotify 개발자 콘솔에 표시된 리디렉트 URL을 추가해 주세요.');
                    } else if (msg.includes('invalid_client')) {
                        showToast('Client ID가 올바르지 않습니다. 값을 다시 확인해 주세요.');
                    } else {
                        showToast(`Spotify 연결 오류: ${msg}`);
                    }
                }
            } catch (e) {
                showToast('Spotify 연결에 실패했습니다. 다시 시도해주세요.');
            }
        };

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
                    
                    <TouchableOpacity style={styles.secondaryActionButton} onPress={handleConnectSpotify}>
                        <Ionicons name="logo-spotify" size={18} color={spotify?.isPremium ? '#1DB954' : '#ffffff'} />
                        <Text style={styles.secondaryActionText}>{spotify?.isPremium ? 'Spotify 연결됨' : 'Spotify 연결'}</Text>
                    </TouchableOpacity>
                </View>

                <HorizontalPlaylist
                    title="나의 플레이리스트"
                    data={userPlaylists}
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