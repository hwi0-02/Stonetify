import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { getMe, logout } from '../store/slices/authSlice';
import { fetchMyPlaylists } from '../store/slices/playlistSlice';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { fetchSavedPosts } from '../store/slices/postSlice'; 
import PostCard from '../components/PostCard';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const ProfileScreen = ({ navigation }) => {
    const dispatch = useDispatch();
    const { user, status: authStatus } = useSelector(state => state.auth);
    const { userPlaylists } = useSelector((state) => state.playlist);
    const { savedPosts } = useSelector(state => state.post);

     // 마운트 시 사용자 정보 로드
    useFocusEffect(
        useCallback(() => {
            dispatch(getMe());
            dispatch(fetchMyPlaylists());
            dispatch(fetchSavedPosts());
        }, [dispatch])
    );
  // user가 없을 때 useEffect로 네비게이션 처리
  useEffect(() => {
        if (authStatus !== 'succeeded' && authStatus !== 'loading' && !user) {
            const rootNav = navigation.getParent()?.getParent();
            rootNav?.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'AuthStack', params: { screen: 'Welcome' } }]
                })
            );
        }
    }, [authStatus, user, navigation]);

  // 로딩 중이면 인디케이터 표시
  if (authStatus === 'loading' && !user) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1DB954" />
            </View>
        );
    }

  if (!user) {
        return null;
    }

    const handleLogout = () => {
        dispatch(logout());
        // 로그아웃 후 화면 전환 로직은 위 useEffect에서 처리됩니다.
    };


    return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>프로필</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={22} color="#b3b3b3" />
        </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent} showsVerticalScrollIndicator={false}>
                <View style={styles.profileInfo}>
                    <View style={styles.profileImageContainer}>
                        <Image 
                            // 수정된 부분: user가 null일 때를 대비해 옵셔널 체이닝(?.)을 사용합니다.
                            source={user?.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile} 
                            style={styles.profileImage} 
                        />
                        <View style={styles.profileBadge}>
                            <Ionicons name="person" size={16} color="#1DB954" />
                        </View>
                    </View>
                    {/* 수정된 부분: user가 null일 때를 대비해 옵셔널 체이닝(?.)을 사용합니다. */}
                    <Text style={styles.displayName}>{user?.display_name}</Text>
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
                {/* ❗ --- '저장한 피드 목록' 섹션 UI 추가 --- ❗ */}
                {savedPosts && savedPosts.length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>저장한 피드</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Saved')}>
                                <Text style={styles.seeAllText}>list &gt;</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                            {savedPosts.slice(0, 5).map(post => (
                                <View key={post.id} style={styles.smallPostCardContainer}>
                                        <PostCard
                                            item={post}
                                            onPress={() => navigation.navigate('PlaylistDetail', { playlistId: post.playlist?.id })}
                                            isCompact={true}
                                        />
                                    </View>
                            ))}
                        </ScrollView>
                    </>
                )}
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
     sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: -0.5,
    },
    seeAllText: {
        color: '#b3b3b3',
        fontSize: 14,
        fontWeight: 'bold',
    },
    horizontalScroll: {
        paddingLeft: 16,
    },
    smallPostCardContainer: {
        width: 170, 
        marginRight: 10,
    },
    smallPostCard: {
        transform: [{ scale: 0.9 }], // PostCard 컴포넌트 자체를 축소
        alignSelf: 'flex-start'
    },
});

export default ProfileScreen;