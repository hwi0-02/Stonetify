/**
 * Lazy Loading Screens - Code Splitting 구현
 * 각 화면을 lazy load하여 초기 번들 크기를 줄입니다.
 */

import React, { lazy, Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Loading Fallback Component
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#1DB954" />
  </View>
);

// Lazy load screens
export const HomeScreen = lazy(() => import('../screens/HomeScreen'));
export const FeedScreen = lazy(() => import('../screens/FeedScreen'));
export const SearchScreen = lazy(() => import('../screens/SearchScreen'));
export const ProfileScreen = lazy(() => import('../screens/ProfileScreen'));
export const SavedScreen = lazy(() => import('../screens/SavedScreen'));
export const PlaylistDetailScreen = lazy(() => import('../screens/PlaylistDetailScreen'));
export const CreatePlaylistScreen = lazy(() => import('../screens/CreatePlaylistScreen'));
export const WriteFeedScreen = lazy(() => import('../screens/WriteFeedScreen'));
export const EditProfileScreen = lazy(() => import('../screens/EditProfileScreen'));
export const UserProfileScreen = lazy(() => import('../screens/UserProfileScreen'));
export const PlayerScreen = lazy(() => import('../screens/PlayerScreen'));
export const ResetPasswordScreen = lazy(() => import('../screens/ResetPasswordScreen'));

// HOC to wrap lazy loaded components with Suspense
export const withSuspense = (Component) => {
  return (props) => (
    <Suspense fallback={<LoadingScreen />}>
      <Component {...props} />
    </Suspense>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
});

export default {
  HomeScreen: withSuspense(HomeScreen),
  FeedScreen: withSuspense(FeedScreen),
  SearchScreen: withSuspense(SearchScreen),
  ProfileScreen: withSuspense(ProfileScreen),
  SavedScreen: withSuspense(SavedScreen),
  PlaylistDetailScreen: withSuspense(PlaylistDetailScreen),
  CreatePlaylistScreen: withSuspense(CreatePlaylistScreen),
  WriteFeedScreen: withSuspense(WriteFeedScreen),
  EditProfileScreen: withSuspense(EditProfileScreen),
  UserProfileScreen: withSuspense(UserProfileScreen),
  PlayerScreen: withSuspense(PlayerScreen),
  ResetPasswordScreen: withSuspense(ResetPasswordScreen),
};
