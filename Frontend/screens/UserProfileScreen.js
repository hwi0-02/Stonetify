import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import apiService from '../services/apiService';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const UserProfileScreen = ({ route }) => {
  const navigation = useNavigation();
  const { userId } = route.params || {};
  const { user: loggedInUser } = useSelector((state) => state.auth);

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isMyProfile = userId && loggedInUser?.id === userId;

  useEffect(() => {
    if (isMyProfile) {
      navigation.replace('Main', { screen: 'Profile' });
    }
  }, [isMyProfile, navigation]);

  useFocusEffect(
    useCallback(() => {
      const fetchProfile = async () => {
        if (!userId || isMyProfile) {
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        try {
          const data = await apiService.getUserProfile(userId);
          setProfile(data);
        } catch (error) {
          Alert.alert('오류', '프로필 정보를 불러오는데 실패했습니다.');
        } finally {
          setIsLoading(false);
        }
      };

      fetchProfile();
    }, [userId, isMyProfile])
  );

  const handleFollowToggle = async () => {
    if (!userId) return;
    if (!loggedInUser) {
      Alert.alert('로그인이 필요한 기능입니다.');
      return;
    }
    try {
      const result = await apiService.toggleFollow(userId);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: result.isFollowing,
              stats: { ...prev.stats, followers: result.followersCount },
            }
          : prev
      );
    } catch (error) {
      Alert.alert('오류', '팔로우 처리에 실패했습니다.');
    }
  };

  if (isMyProfile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!profile?.user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>프로필 정보를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const { user, playlists = [], stats = {}, isFollowing } = profile;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>프로필</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <Image
            source={user.profile_image_url ? { uri: user.profile_image_url } : placeholderProfile}
            style={styles.avatar}
          />
          <Text style={styles.displayName}>{user.display_name || '사용자'}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{playlists.length}</Text>
              <Text style={styles.statLabel}>플레이리스트</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.followers || 0}</Text>
              <Text style={styles.statLabel}>팔로워</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.following || 0}</Text>
              <Text style={styles.statLabel}>팔로잉</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={isFollowing ? styles.secondaryButton : styles.primaryButton}
            onPress={handleFollowToggle}
          >
            <Ionicons
              name={isFollowing ? 'checkmark' : 'person-add-outline'}
              size={20}
              color={isFollowing ? '#ffffff' : '#121212'}
            />
            <Text style={isFollowing ? styles.secondaryButtonText : styles.primaryButtonText}>
              {isFollowing ? '팔로잉' : '팔로우'}
            </Text>
          </TouchableOpacity>
        </View>

        <HorizontalPlaylist
          title={`${user.display_name || '사용자'}의 플레이리스트`}
          data={playlists}
          onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
        />
      </ScrollView>
    </View>
  );
};

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
  },
  backButton: { padding: 5 },
  headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  headerSpacer: { width: 40 },
  scrollContent: { paddingBottom: 100 },
  profileSection: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 16 },
  displayName: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 0,
  },
  statItem: { alignItems: 'center', minWidth: 90 },
  statValue: { color: '#ffffff', fontSize: 24, fontWeight: '800', marginBottom: 6 },
  statLabel: {
    color: '#b3b3b3',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 16,
  },
  statDivider: { width: 1, height: 24, backgroundColor: '#404040', marginHorizontal: 30 },
  actionSection: { paddingHorizontal: 20, marginVertical: 20, marginTop: 10 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 28,
  },
  primaryButtonText: { color: '#121212', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#282828',
    paddingVertical: 14,
    borderRadius: 28,
  },
  secondaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  errorText: { color: '#ffffff', fontSize: 16 },
});

export default UserProfileScreen;
