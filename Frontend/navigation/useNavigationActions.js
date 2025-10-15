import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

const useNavigationActions = () => {
  const navigation = useNavigation();

  const goTo = useCallback((screen, params) => {
    if (!screen) return;
    navigation.navigate(screen, params);
  }, [navigation]);

  const goToPlaylistDetail = useCallback((playlistId) => {
    if (!playlistId) return;
    goTo('PlaylistDetail', { playlistId });
  }, [goTo]);

  const goToProfile = useCallback(() => {
    goTo('Profile');
  }, [goTo]);

  const goToCreatePlaylist = useCallback(() => {
    goTo('CreatePlaylist');
  }, [goTo]);

  const goToSearch = useCallback(() => {
    goTo('Search');
  }, [goTo]);

  const goToFeed = useCallback(() => {
    goTo('Feed');
  }, [goTo]);

  const goToWriteFeed = useCallback((post) => {
    goTo('WriteFeed', post ? { post } : undefined);
  }, [goTo]);

  const goToUserProfile = useCallback((userId) => {
    if (!userId) return;
    goTo('UserProfile', { userId });
  }, [goTo]);

  return {
    goTo,
    goToPlaylistDetail,
    goToProfile,
    goToCreatePlaylist,
    goToSearch,
    goToFeed,
    goToWriteFeed,
    goToUserProfile,
  };
};

export default useNavigationActions;
