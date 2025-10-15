import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import HorizontalPlaylist from '../components/HorizontalPlaylist';
import apiService from '../services/apiService';
import { createStyles } from '../utils/ui';
import {
  buttonPrimary,
  buttonSecondary,
  pressableHitSlop,
  textVariants,
  card as cardStyle,
} from '../utils/uiComponents';
import { useAppSelector, selectAuthUser } from '../store/hooks';

const placeholderProfile = require('../assets/images/placeholder_album.png');

const UserProfileScreen = ({ route }) => {
  const navigation = useNavigation();
  const { userId } = route.params || {};
  const loggedInUser = useAppSelector(selectAuthUser);

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

  const loading = isMyProfile || isLoading;

  const { user, playlists = [], stats = {}, isFollowing } = profile || {};

  const playlistTitle = useMemo(() => {
    if (!user?.display_name) return '사용자의 플레이리스트';
    return `${user.display_name}의 플레이리스트`;
  }, [user?.display_name]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={styles.accentColor.color} />
      </View>
    );
  }

  if (!profile?.user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>프로필 정보를 찾을 수 없습니다.</Text>
        <Text style={styles.emptyDescription}>다시 시도해 주세요.</Text>
      </View>
    );
  }

  const followersCount = stats.followers || 0;
  const followingCount = stats.following || 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={pressableHitSlop}
        >
          <Ionicons name="arrow-back" size={22} color={styles.headerTitle.color} />
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
              <Text style={styles.statValue}>{followersCount}</Text>
              <Text style={styles.statLabel}>팔로워</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{followingCount}</Text>
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
              color={isFollowing ? styles.secondaryButtonText.color : styles.primaryButtonText.color}
            />
            <Text style={isFollowing ? styles.secondaryButtonText : styles.primaryButtonText}>
              {isFollowing ? '팔로잉' : '팔로우'}
            </Text>
          </TouchableOpacity>
        </View>

        <HorizontalPlaylist
          title={playlistTitle}
          data={playlists}
          onItemPress={(item) => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
        />
      </ScrollView>
    </View>
  );
};

const styles = createStyles(({ colors, spacing, typography, radii }) => ({
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
  emptyTitle: {
    ...typography.subheading,
  },
  emptyDescription: {
    ...textVariants.subtitle,
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
  backButton: {
    ...cardStyle({ padding: spacing.xs, withBorder: false }),
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.heading,
    fontSize: 24,
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.xl,
  },
  profileSection: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
  },
  displayName: {
    ...typography.heading,
    fontSize: 28,
  },
  statsRow: {
    ...cardStyle({ padding: spacing.md, muted: true, withBorder: false }),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 90,
    gap: spacing.xs,
  },
  statValue: {
    ...typography.heading,
    fontSize: 22,
  },
  statLabel: {
    ...textVariants.subtitle,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: colors.divider,
  },
  actionSection: {
    paddingHorizontal: spacing.lg,
  },
  primaryButton: {
    ...buttonPrimary({}),
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    ...buttonSecondary({}),
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
}));

export default UserProfileScreen;
