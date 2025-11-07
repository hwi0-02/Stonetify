import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch, useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { getMe, logout, updateFollowStats } from '../store/slices/authSlice';
import { fetchMyPlaylists, fetchLikedPlaylists } from '../store/slices/playlistSlice';
import { fetchRecentPlaylists } from '../store/slices/recentPlaylistsSlice';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import { playTrackWithPlaylist } from '../store/slices/playerSlice';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { showToast } from '../utils/toast';
import { exchangeSpotifyCode, getPremiumStatus, fetchSpotifyProfile, clearSpotifySessionWithStorage } from '../store/slices/spotifySlice';
import apiService from '../services/apiService';

const { width: screenWidth } = Dimensions.get('window');

const placeholderProfile = require('../assets/images/placeholder_album.png');

const ProfileScreen = ({ navigation, route }) => {
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth);
    const followStatsFromStore = useSelector(
        (state) => state.auth.followStats || { followers: 0, following: 0 }
    );
    const { userPlaylists } = useSelector((state) => state.playlist);
    const likedPlaylists = useSelector((state) => state.playlist.likedPlaylists);
    const recentPlaylists = useSelector((state) => state.recentPlaylists.items);
    const spotify = useSelector((state) => state.spotify);
    const userId = user?.id || user?.userId;
    const [profileStats, setProfileStats] = useState({ followers: 0, following: 0 });
    const followStatsRef = useRef(profileStats);
    const deviceSetupDoneRef = useRef(false); // 디바이스 설정이 한 번만 실행되도록
    const spotifyReauthWarningRef = useRef(false);

    // Spotify 인증 훅 사용 (입력: userId, 효과: 인증 플로우 관리)
    const { connectSpotify, redirectUri, authError } = useSpotifyAuth(userId);

    useEffect(() => {
        // 사용자 정보 및 플레이리스트 로드
        if (!user) {
            dispatch(getMe());
        }
        dispatch(fetchMyPlaylists());
        dispatch(fetchLikedPlaylists());
        dispatch(fetchRecentPlaylists());
    }, [dispatch]);

    useEffect(() => {
        const normalized = {
            followers: followStatsFromStore.followers ?? 0,
            following: followStatsFromStore.following ?? 0,
        };
        followStatsRef.current = normalized;
        setProfileStats(normalized);
    }, [followStatsFromStore]);

    const loadProfileStats = useCallback(async () => {
        if (!userId) return;
        try {
            const data = await apiService.getUserProfile(userId, { forceRefresh: true });
            const stats = data?.stats || {};
            const normalized = {
                followers: stats.followers ?? 0,
                following: stats.following ?? 0,
            };
            followStatsRef.current = normalized;
            setProfileStats(normalized);
            dispatch(updateFollowStats(normalized));
        } catch (error) {
            console.warn('Failed to load profile stats', error);
        }
    }, [userId, dispatch]);

    useEffect(() => {
        loadProfileStats();
    }, [loadProfileStats]);

    // Spotify 연결되어 있을 때 자동으로 모바일 디바이스로 강제 전환
    useEffect(() => {
        if (!spotify?.accessToken) {
            deviceSetupDoneRef.current = false;
        } else {
            spotifyReauthWarningRef.current = false;
        }
    }, [spotify?.accessToken]);

    useEffect(() => {
        const autoSetupMobileDevice = async () => {
            // 이미 설정했거나, Spotify가 연결되지 않았으면 스킵
            if (
                deviceSetupDoneRef.current ||
                !spotify?.accessToken ||
                !spotify?.isPremium ||
                spotify?.requiresReauth ||
                !userId
            ) {
                return;
            }

            deviceSetupDoneRef.current = true; // 한 번만 실행되도록 표시

            try {
                console.log('[ProfileScreen] 🔍 Checking for mobile device...');

                // 디바이스 목록을 여러 번 시도
                let devices = [];
                let attempts = 0;
                const maxAttempts = 3;

                const isTokenRevokedError = (err) => {
                    if (!err) return false;
                    if (err.requiresReauth) return true;
                    const code = err.code || err.response?.data?.error;
                    if (typeof code === 'string' && code.toUpperCase() === 'TOKEN_REVOKED') {
                        return true;
                    }
                    const message =
                        err?.response?.data?.message ||
                        err?.message ||
                        '';
                    return /만료되었습니다|다시 로그인/i.test(message);
                };

                while (attempts < maxAttempts) {
                    try {
                        const devicesData = await apiService.getRemoteDevices(userId);
                        devices = devicesData?.devices || [];
                        if (devices.length > 0) break;
                        attempts++;
                        if (attempts < maxAttempts) {
                            console.log(`[ProfileScreen] No devices found, retrying... (${attempts}/${maxAttempts})`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    } catch (e) {
                        if (isTokenRevokedError(e)) {
                            if (!spotifyReauthWarningRef.current) {
                                console.warn('[ProfileScreen] Spotify session expired; skipping auto device setup until reconnected.');
                                spotifyReauthWarningRef.current = true;
                            }
                            attempts = maxAttempts;
                            break;
                        }
                        console.warn('[ProfileScreen] Device fetch attempt failed:', e?.message || e);
                        attempts++;
                        if (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }

                if (devices.length > 0) {
                    // 모바일 디바이스 찾기
                    const mobileDevice = devices.find(d => d.type === 'Smartphone');

                    if (mobileDevice) {
                        console.log('[ProfileScreen] ✅ Found mobile device:', mobileDevice.name, '(active:', mobileDevice.is_active + ')');

                        // 모바일 디바이스가 비활성 상태이거나 다른 디바이스가 활성 상태일 때 강제 전환
                        if (!mobileDevice.is_active) {
                            try {
                                // play: true로 강제 활성화
                                await apiService.transferRemotePlayback({
                                    userId: userId,
                                    device_id: mobileDevice.id,
                                    play: true
                                });
                                console.log('[ProfileScreen] ✅ Forcefully transferred playback to mobile device');

                                // 즉시 일시정지
                                await new Promise(resolve => setTimeout(resolve, 500));
                                await apiService.pauseRemote(userId);
                                console.log('[ProfileScreen] ✅ Paused to keep device active');
                            } catch (transferError) {
                                console.warn('[ProfileScreen] Transfer failed:', transferError.message);
                                // 재시도
                                try {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    await apiService.transferRemotePlayback({
                                        userId: userId,
                                        device_id: mobileDevice.id,
                                        play: false
                                    });
                                    console.log('[ProfileScreen] ✅ Retried successfully');
                                } catch (retryError) {
                                    console.warn('[ProfileScreen] Retry failed:', retryError.message);
                                }
                            }
                        } else {
                            console.log('[ProfileScreen] ℹ️ Mobile device already active');
                        }
                    } else {
                        console.log('[ProfileScreen] ℹ️ No mobile device found');
                    }
                }
            } catch (error) {
                const message = error?.message || '알 수 없는 오류';
                if (!spotifyReauthWarningRef.current) {
                    console.warn('[ProfileScreen] ⚠️ Auto device setup failed (non-fatal):', message);
                }
            }
        };

        // ProfileScreen이 처음 마운트되고 Spotify가 연결되었을 때만 실행
        autoSetupMobileDevice();
    }, [spotify?.accessToken, spotify?.isPremium, spotify?.requiresReauth, userId]);

    useFocusEffect(
        useCallback(() => {
            loadProfileStats();
            // 플레이리스트 목록도 새로고침
            dispatch(fetchMyPlaylists());
            dispatch(fetchLikedPlaylists());
        }, [loadProfileStats, dispatch])
    );

    if (!user) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#8A2BE2" /></View>;
    }

    // 라우트 파라미터로 온 postConnect가 있고 아직 연결 안 됐다면 자동 연결 시도
    useEffect(() => {
        if (!spotify?.accessToken && route?.params?.postConnect) {
            // 새 함수: 자동 연결 시도 (입력 없음, 효과: Spotify 인증 플로우 시작)
            connectSpotify();
        }
    }, [route?.params?.postConnect, spotify?.accessToken, connectSpotify]);

    // 연결 성공 후 postConnect 액션 처리 (전체곡 재생)
    useEffect(() => {
        if (spotify?.accessToken && route?.params?.postConnect?.action === 'playAll') {
            const playlist = Array.isArray(route.params.postConnect.playlist) ? route.params.postConnect.playlist : [];
            if (playlist.length) {
                (async () => {
                    try {
                        await dispatch(playTrackWithPlaylist({ playlist }));
                        navigation.navigate('Player');
                    } catch (e) {
                        showToast('재생을 시작하지 못했습니다.');
                    } finally {
                        try { navigation.setParams({ postConnect: undefined }); } catch (_) {}
                    }
                })();
            }
        }
    }, [spotify?.accessToken, route?.params?.postConnect, dispatch, navigation]);

    const resolveRedirectCandidates = () => {
        const candidates = [];
        const seen = new Set();
        
        // Expo Go 감지를 더 신뢰성있게 수행
        const isExpoGo = Constants.appOwnership === 'expo' || 
                        Constants.executionEnvironment === 'storeClient' ||
                        !Constants.expoConfig?.ios?.bundleIdentifier;

        const addCandidate = (uri, useProxy, source) => {
            if (!uri) return;
            const trimmed = uri.trim();
            if (!trimmed || seen.has(trimmed)) return;
            candidates.push({ redirectUri: trimmed, useProxy, source });
            seen.add(trimmed);
        };

        console.log('[SpotifyAuth] Environment detection:', {
            appOwnership: Constants.appOwnership,
            executionEnvironment: Constants.executionEnvironment,
            isExpoGo,
        });

        // 1. 환경 변수 최우선
        const envRedirect = (process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI
            || Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI
            || Constants.expoConfig?.extra?.spotifyRedirectUri)?.trim();

        if (envRedirect) {
            const isProxyUrl = envRedirect.startsWith('https://auth.expo.dev/');
            addCandidate(envRedirect, isProxyUrl, 'env_override');
            console.log('[SpotifyAuth] Using env override:', envRedirect, 'useProxy:', isProxyUrl);
        }

        // 2. Expo Go인 경우 프록시 URL만 사용 (동의 후 복귀를 위해 필수)
        if (isExpoGo) {
            const expoProxyUri = AuthSession.makeRedirectUri({ 
                useProxy: true, 
                scheme: 'stonetify'
            });
            addCandidate(expoProxyUri, true, 'expo_proxy');
            console.log('[SpotifyAuth] ✅ Expo Go detected, MUST use proxy:', expoProxyUri);
        } else {
            // 3. 스탠드얼론/Dev Client인 경우 커스텀 스킴 우선
            const customSchemeUri = AuthSession.makeRedirectUri({ 
                useProxy: false, 
                scheme: 'stonetify' 
            });
            addCandidate(customSchemeUri, false, 'custom_scheme');
            console.log('[SpotifyAuth] Standalone build detected, using custom scheme:', customSchemeUri);
        }

        return candidates;
    };

    const handleConnectSpotify = async () => {
        try {
            // 기존 Spotify 세션 완전히 제거 (새로운 scope로 재인증 필요)
            console.log('[SpotifyAuth] Clearing any existing Spotify session before new login...');
            await dispatch(clearSpotifySessionWithStorage({ reason: 'proactive_reauth' }));
            await AsyncStorage.setItem('spotifyNeedsReauth', 'true');
            
            const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
                || process.env.SPOTIFY_CLIENT_ID
                || Constants.expoConfig?.extra?.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
                || Constants.expoConfig?.extra?.spotifyClientId;

            const candidates = resolveRedirectCandidates();
            if (!candidates.length) {
                showToast('Spotify 리디렉트 URI를 구성할 수 없습니다. 설정을 확인해주세요.');
                return;
            }

            const scopes = [
                'user-read-email',
                'user-read-private',
                'user-read-playback-state',
                'user-modify-playback-state',
                'user-read-currently-playing',
                'user-library-read',
                'user-library-modify',
                'playlist-read-private',
                'playlist-read-collaborative',
                'playlist-modify-public',
                'playlist-modify-private',
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
            let authContext = null;
            let lastErrorMessage = null;

            for (const candidate of candidates) {
                try {
                    console.log('[SpotifyAuth] ===== Attempting redirect URI =====');
                    console.log('[SpotifyAuth] URI:', candidate.redirectUri);
                    console.log('[SpotifyAuth] Source:', candidate.source);
                    console.log('[SpotifyAuth] Use Proxy:', candidate.useProxy);
                    console.log('[SpotifyAuth] Client ID:', clientId);
                    console.log('[SpotifyAuth] =====================================');
                    
                    const request = new AuthSession.AuthRequest({
                        clientId,
                        redirectUri: candidate.redirectUri,
                        scopes,
                        usePKCE: true,
                        responseType: AuthSession.ResponseType.Code,
                    });
                    await request.makeAuthUrlAsync(discovery);
                    console.log('[SpotifyAuth] Auth URL prepared, opening browser...');

                    // Expo Go에서는 반드시 useProxy를 명시적으로 전달
                    const promptOptions = { 
                        useProxy: candidate.useProxy,
                        showInRecents: false,
                    };
                    
                    console.log('[SpotifyAuth] Prompt options:', promptOptions);
                    const res = await request.promptAsync(discovery, promptOptions);
                    console.log('[SpotifyAuth] Auth response received:', res.type);

                    if (res.type === 'success' && res.params?.code) {
                        const resolvedRedirect = request.redirectUri || candidate.redirectUri;
                        console.log('[SpotifyAuth] ✅ Authorization successful!');
                        console.log('[SpotifyAuth] Code received:', res.params.code.substring(0, 10) + '...');
                        console.log('[SpotifyAuth] Final redirect URI:', resolvedRedirect);
                        authContext = { request, candidate: { ...candidate, redirectUri: resolvedRedirect }, res };
                        break;
                    }

                    if (res.type === 'dismiss' || res.type === 'cancel') {
                        console.log('[SpotifyAuth] User cancelled authorization');
                        showToast('Spotify 연결이 취소되었습니다.');
                        return;
                    }
                    
                    if (res.type === 'locked') {
                        console.warn('[SpotifyAuth] Browser locked, might need user interaction');
                        continue;
                    }

                    if (res.type === 'error' || res.params?.error) {
                        const msg = res.params?.error_description || res.params?.error || '알 수 없는 오류';
                        lastErrorMessage = msg;
                        console.error('[SpotifyAuth] Auth error:', msg);
                        console.error('[SpotifyAuth] Error params:', res.params);
                        if (msg.toLowerCase().includes('redirect') || msg.toLowerCase().includes('invalid_client')) {
                            console.warn('[SpotifyAuth] ⚠️ Redirect URI rejected, trying next candidate...');
                            continue;
                        }
                        showToast(`Spotify 연결 오류: ${msg}`);
                        return;
                    }
                } catch (candidateError) {
                    const msg = candidateError?.response?.data?.error_description
                        || candidateError?.response?.data?.error
                        || candidateError?.message
                        || '알 수 없는 오류';
                    lastErrorMessage = msg;
                    if (msg.includes('redirect_uri') || msg.includes('invalid_client')) {
                        console.warn('[SpotifyAuth] Redirect candidate failed:', msg);
                        continue;
                    }
                    console.error('[SpotifyAuth] Unexpected error during auth', candidateError);
                    showToast('Spotify 연결에 실패했습니다. 다시 시도해주세요.');
                    return;
                }
            }

            if (!authContext) {
                const detail = lastErrorMessage ? ` 상세: ${lastErrorMessage}` : '';
                showToast(`Spotify 리디렉트 설정을 확인해주세요.${detail}`);
                return;
            }

            const { request, candidate, res } = authContext;
            const codeVerifier = request.codeVerifier;
            
            console.log('[SpotifyAuth] Exchanging code for token...');
            console.log('[SpotifyAuth] Redirect URI for exchange:', candidate.redirectUri);
            
            try {
                await dispatch(exchangeSpotifyCode({
                    code: res.params.code,
                    code_verifier: codeVerifier,
                    redirect_uri: candidate.redirectUri,
                    userId: user.id || user.userId,
                })).unwrap();
                await AsyncStorage.removeItem('spotifyNeedsReauth');
                
                console.log('[SpotifyAuth] ✅ Token exchange successful');
                showToast('Spotify 연결 성공!');

                await dispatch(getPremiumStatus());
                await dispatch(fetchSpotifyProfile());

                // 자동으로 모바일 디바이스 찾고 강제 전환
                try {
                    console.log('[SpotifyAuth] 🔍 Auto-detecting mobile device...');
                    // 디바이스 목록을 여러 번 시도 (Spotify API가 즉시 업데이트되지 않을 수 있음)
                    let devices = [];
                    let attempts = 0;
                    const maxAttempts = 3;

                    while (attempts < maxAttempts) {
                        try {
                            const devicesData = await apiService.getRemoteDevices(user.id || user.userId);
                            devices = devicesData?.devices || [];
                            if (devices.length > 0) break;
                            attempts++;
                            if (attempts < maxAttempts) {
                                console.log(`[SpotifyAuth] No devices found, retrying... (${attempts}/${maxAttempts})`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        } catch (e) {
                            console.warn('[SpotifyAuth] Device fetch attempt failed:', e.message);
                            attempts++;
                            if (attempts < maxAttempts) {
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                        }
                    }

                    if (devices.length > 0) {
                        // 모바일 디바이스 우선 찾기
                        let mobileDevice = devices.find(d => d.type === 'Smartphone');

                        if (mobileDevice) {
                            console.log('[SpotifyAuth] ✅ Found mobile device:', mobileDevice.name);
                            // 모바일 디바이스로 강제 전환 (play: true로 활성화)
                            try {
                                await apiService.transferRemotePlayback({
                                    userId: user.id || user.userId,
                                    device_id: mobileDevice.id,
                                    play: true // 강제로 활성화
                                });
                                console.log('[SpotifyAuth] ✅ Forcefully transferred playback to mobile device');

                                // 즉시 일시정지하여 재생은 방지하되 디바이스는 활성 상태 유지
                                await new Promise(resolve => setTimeout(resolve, 500));
                                await apiService.pauseRemote(user.id || user.userId);
                                console.log('[SpotifyAuth] ✅ Paused playback to keep device active');
                            } catch (transferError) {
                                console.warn('[SpotifyAuth] Transfer or pause failed:', transferError.message);
                                // 재시도
                                try {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                    await apiService.transferRemotePlayback({
                                        userId: user.id || user.userId,
                                        device_id: mobileDevice.id,
                                        play: false
                                    });
                                    console.log('[SpotifyAuth] ✅ Retried device transfer successfully');
                                } catch (retryError) {
                                    console.warn('[SpotifyAuth] Retry failed:', retryError.message);
                                }
                            }
                        } else {
                            console.log('[SpotifyAuth] ℹ️ No mobile device found, available devices:', devices.map(d => ({ name: d.name, type: d.type })));
                            showToast('모바일에서 Spotify 앱을 열어주세요');
                        }
                    } else {
                        console.log('[SpotifyAuth] ℹ️ No devices available after all attempts');
                        showToast('Spotify 앱을 열어 디바이스를 활성화해주세요');
                    }
                } catch (deviceError) {
                    console.warn('[SpotifyAuth] ⚠️ Auto device transfer failed (non-fatal):', deviceError.message);
                    // 디바이스 전환 실패는 치명적이지 않으므로 무시
                }
            } catch (tokenError) {
                console.error('[SpotifyAuth] Token exchange failed:', tokenError);
                throw tokenError;
            }
        } catch (e) {
            showToast('Spotify 연결에 실패했습니다. 다시 시도해주세요.');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                        <Text style={styles.headerTitle}>프로필</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={styles.editButton}>
                                <Ionicons name="create-outline" size={22} color="#b3b3b3" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => dispatch(logout())} style={styles.logoutButton}>
                                <Ionicons name="log-out-outline" size={22} color="#b3b3b3" />
                            </TouchableOpacity>
                        </View>
                    </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
                {spotify.requiresReauth && (
                    <View style={styles.spotifyNotice}>
                        <Text style={styles.spotifyNoticeTitle}>Spotify 재연결이 필요합니다</Text>
                        <Text style={styles.spotifyNoticeText}>
                            Spotify 토큰이 만료되었습니다. 아래의 "Spotify 연결" 버튼으로 다시 로그인해 주세요.
                        </Text>
                    </View>
                )}

                <View style={styles.profileInfo}>
                    <View style={styles.profileImageContainer}>
                        <Image
                            source={user.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile}
                            style={styles.profileImage}
                        />
                        <View style={styles.profileBadge}>
                            <Ionicons name="person" size={16} color="#cfcfcfff" />
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
                            <Text style={styles.statNumber}>{profileStats.followers}</Text>
                            <Text style={styles.statLabel}>팔로워</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{profileStats.following}</Text>
                            <Text style={styles.statLabel}>팔로잉</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity style={styles.primaryActionButton} onPress={() => navigation.navigate('CreatePlaylist')}>
                        <Ionicons name="add" size={20} color="#ffffffff" />
                        <Text style={styles.primaryActionText}>새 플레이리스트</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryActionButton} onPress={connectSpotify}>
                        <FontAwesome5 name="spotify" size={18} color={spotify?.isPremium ? '#1DB954' : '#1DB954'} />
                        <Text style={styles.secondaryActionText}>{spotify?.isPremium ? 'Spotify 연결됨' : 'Spotify 연결'}</Text>
                    </TouchableOpacity>
                </View>

                <HorizontalPlaylist
                    title="나의 플레이리스트"
                    data={userPlaylists}
                    onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                />
                <HorizontalPlaylist
                    title="좋아요한 플레이리스트"
                    data={likedPlaylists}
                    onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
                />
                <HorizontalPlaylist
                    title="최근에 본 플레이리스트"
                    data={recentPlaylists}
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    editButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    logoutButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#282828',
        justifyContent: 'center',
        alignItems: 'center',
    },
    spotifyNotice: {
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 12,
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(29, 185, 84, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(29, 185, 84, 0.4)',
    },
    spotifyNoticeTitle: {
        color: '#b04ad8ff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    spotifyNoticeText: {
        color: '#e0ffe9',
        fontSize: 13,
        lineHeight: 18,
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
        borderColor: '#c4c4c4ff',
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
        justifyContent: 'space-evenly',
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 16,
        marginHorizontal: 20,
        width: screenWidth - 40,
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: 8,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: '#404040',
        marginHorizontal: 12,
    },
    statNumber: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    statLabel: {
        color: '#b3b3b3',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: 'center',
        lineHeight: 14,
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
        backgroundColor: '#b04ad8ff',
        paddingVertical: 14,
        borderRadius: 28,
        shadowColor: '#b04ad8ff',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    primaryActionText: {
        color: '#ffffffff',
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
    socialSection: {
        marginHorizontal: 20,
        marginBottom: 32,
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: 20,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },
    connectionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#282828',
    },
    connectionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    providerIconContainer: {
        marginRight: 12,
    },
    providerTextContainer: {
        flex: 1,
    },
    providerName: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    connectionStatus: {
        color: '#b3b3b3',
        fontSize: 13,
    },
    connectButton: {
        backgroundColor: '#282828',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#404040',
    },
    connectButtonText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '600',
    },
    disconnectButton: {
        backgroundColor: 'transparent',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#b04ad8ff',
    },
    disconnectButtonText: {
        color: '#b04ad8ff',
        fontSize: 13,
        fontWeight: '600',
    },
});

export default ProfileScreen;
