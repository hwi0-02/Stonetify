import React, { useEffect, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { getMe, logout } from '../store/slices/authSlice';
import { fetchMyPlaylists, fetchLikedPlaylists } from '../store/slices/playlistSlice';
import { fetchRecentPlaylists } from '../store/slices/recentPlaylistsSlice';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import { playTrackWithPlaylist } from '../store/slices/playerSlice';
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { showToast } from '../utils/toast';
import { exchangeSpotifyCode, getPremiumStatus, fetchSpotifyProfile, clearSpotifySession } from '../store/slices/spotifySlice';
import { createStyles } from '../utils/ui';
import {
    buttonPrimary,
    buttonSecondary,
    iconButton as iconButtonStyle,
    pressableHitSlop,
    textVariants,
    section as sectionStyle,
} from '../utils/uiComponents';
import {
    useAppDispatch,
    useAppSelector,
    selectAuthUser,
    selectPlaylistState,
} from '../store/hooks';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const ProfileScreen = ({ navigation, route }) => {
    const dispatch = useAppDispatch();
    const user = useAppSelector(selectAuthUser);
    const playlistState = useAppSelector(selectPlaylistState);
    const likedPlaylists = useAppSelector((state) => state.playlist.likedPlaylists);
    const recentPlaylists = useAppSelector((state) => state.recentPlaylists.items);
    const spotify = useAppSelector((state) => state.spotify);
    const userPlaylists = playlistState.userPlaylists || [];
    const userId = user?.id || user?.userId;
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

    if (!user) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={styles.accentColor.color} />
            </View>
        );
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
            await dispatch(clearSpotifySession({ reason: 'proactive_reauth' }));
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
                    <TouchableOpacity
                        onPress={() => navigation.navigate('EditProfile')}
                        style={styles.headerButton}
                        hitSlop={pressableHitSlop}
                    >
                        <Ionicons name="create-outline" size={22} color={styles.iconMuted.color} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => dispatch(logout())}
                        style={styles.headerButton}
                        hitSlop={pressableHitSlop}
                    >
                        <Ionicons name="log-out-outline" size={22} color={styles.iconMuted.color} />
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

                {__DEV__ && (
                    <View style={styles.devInfoBox}>
                        <Text style={styles.devInfoTitle}>Dev Redirect URI</Text>
                        <Text style={styles.devInfoValue}>{redirectUri}</Text>
                        {authError && authError.toLowerCase().includes('redirect') && (
                            <Text style={styles.devInfoHint}>
                                Spotify 대시보드에 위 URI가 등록되어 있는지 다시 확인하세요.
                            </Text>
                        )}
                    </View>
                )}

                <View style={styles.profileInfo}>
                    <View style={styles.profileImageContainer}>
                        <Image
                            source={user.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile}
                            style={styles.profileImage}
                        />
                        <View style={styles.profileBadge}>
                            <Ionicons name="person" size={16} color={styles.spotifyIconConnected.color} />
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
                    <TouchableOpacity
                        style={styles.primaryActionButton}
                        onPress={() => navigation.navigate('CreatePlaylist')}
                        hitSlop={pressableHitSlop}
                    >
                        <Ionicons name="add" size={20} color={styles.primaryActionIcon.color} />
                        <Text style={styles.primaryActionText}>새 플레이리스트</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryActionButton}
                        onPress={connectSpotify}
                        hitSlop={pressableHitSlop}
                    >
                        <FontAwesome5
                            name="spotify"
                            size={18}
                            color={(spotify?.isPremium ? styles.spotifyIconConnected : styles.spotifyIconDisconnected).color}
                        />
                        <Text style={styles.secondaryActionText}>
                            {spotify?.isPremium ? 'Spotify 연결됨' : 'Spotify 연결'}
                        </Text>
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
const styles = createStyles(({ colors, spacing, typography, radii, elevation }) => ({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
        gap: spacing.sm,
    },
    accentColor: {
        color: colors.accent,
    },
    iconMuted: {
        color: colors.textSecondary,
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitle: {
        ...typography.heading,
        fontSize: 28,
        letterSpacing: -0.5,
    },
    headerButton: {
        ...iconButtonStyle({ size: 42 }),
        backgroundColor: colors.surface,
    },
    spotifyNotice: {
        ...sectionStyle({ padding: spacing.md }),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.accent,
        backgroundColor: 'rgba(29, 185, 84, 0.12)',
        gap: spacing.xs,
    },
    spotifyNoticeTitle: {
        ...typography.subheading,
        color: colors.accent,
    },
    spotifyNoticeText: {
        ...textVariants.subtitle,
        color: '#e0ffe9',
    },
    devInfoBox: {
        ...sectionStyle({ padding: spacing.sm }),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        gap: spacing.xs,
    },
    devInfoTitle: {
        ...textVariants.subtitle,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    devInfoValue: {
        ...textVariants.subtitle,
        fontSize: 12,
        color: colors.textPrimary,
    },
    devInfoHint: {
        ...textVariants.subtitle,
        color: '#f7b733',
        fontSize: 11,
    },
    profileInfo: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    profileImageContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
        position: 'relative',
        ...elevation.card,
    },
    profileImage: {
        width: 140,
        height: 140,
        borderRadius: 70,
    },
    profileBadge: {
        position: 'absolute',
        bottom: spacing.xs,
        right: spacing.xs,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.background,
        borderWidth: 2,
        borderColor: colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
    },
    displayName: {
        ...typography.heading,
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: -0.8,
        textAlign: 'center',
    },
    statsContainer: {
        ...sectionStyle({ padding: spacing.md }),
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
    },
    statItem: {
        alignItems: 'center',
        minWidth: 90,
        gap: spacing.xs,
    },
    statDivider: {
        width: StyleSheet.hairlineWidth,
        height: 32,
        backgroundColor: colors.divider,
    },
    statNumber: {
        ...typography.heading,
        fontSize: 24,
    },
    statLabel: {
        ...textVariants.subtitle,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
        gap: spacing.md,
    },
    primaryActionButton: {
        ...buttonPrimary({}),
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    primaryActionText: {
        color: colors.background,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    primaryActionIcon: {
        color: colors.background,
    },
    secondaryActionButton: {
        ...buttonSecondary({}),
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    secondaryActionText: {
        color: colors.textPrimary,
        fontSize: 15,
        fontWeight: '600',
    },
    secondaryActionIcon: {
        color: colors.textPrimary,
    },
    scrollViewContent: {
        paddingBottom: spacing.xxl * 2,
        backgroundColor: colors.background,
        gap: spacing.xl,
    },
    spotifyIconConnected: {
        color: colors.accent,
    },
    spotifyIconDisconnected: {
        color: colors.textPrimary,
    },
}));

export default ProfileScreen;