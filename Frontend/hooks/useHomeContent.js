import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector, selectAuthUser, selectPlaylistState, selectPostState } from '../store/hooks';
import {
  fetchPosts,
  toggleLikePost,
  toggleSavePost,
} from '../store/slices/postSlice';
import {
  fetchMyPlaylists,
  fetchLikedPlaylists,
  fetchRecommendedPlaylists,
  fetchForYouPlaylists,
  createShareLinkAsync,
} from '../store/slices/playlistSlice';

const useHomeContent = () => {
  const dispatch = useAppDispatch();
  const postsState = useAppSelector(selectPostState);
  const playlistState = useAppSelector(selectPlaylistState);
  const user = useAppSelector(selectAuthUser);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dispatch(fetchPosts());
    dispatch(fetchMyPlaylists());
    dispatch(fetchLikedPlaylists());
    dispatch(fetchRecommendedPlaylists());
    dispatch(fetchForYouPlaylists());
  }, [dispatch]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchPosts()),
        dispatch(fetchMyPlaylists()),
        dispatch(fetchLikedPlaylists()),
        dispatch(fetchRecommendedPlaylists()),
        dispatch(fetchForYouPlaylists()),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  const popularPosts = useMemo(() => {
    if (!Array.isArray(postsState?.posts)) return [];
    return [...postsState.posts]
      .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
      .slice(0, 5);
  }, [postsState?.posts]);

  const likePost = useCallback((postId) => dispatch(toggleLikePost(postId)), [dispatch]);
  const savePost = useCallback((postId) => dispatch(toggleSavePost(postId)), [dispatch]);
  const createShareLink = useCallback((playlistId) => dispatch(createShareLinkAsync(playlistId)).unwrap(), [dispatch]);

  return {
    user,
    posts: postsState?.posts || [],
    postStatus: postsState?.status,
    userPlaylists: playlistState?.userPlaylists || [],
    recommendedPlaylists: playlistState?.recommendedPlaylists || [],
    forYouPlaylists: playlistState?.forYouPlaylists || [],
    refreshing,
    refresh,
    popularPosts,
    likePost,
    savePost,
    createShareLink,
  };
};

export default useHomeContent;
