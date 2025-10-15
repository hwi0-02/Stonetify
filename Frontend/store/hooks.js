import { useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

export const selectAuthUser = (state) => state.auth.user;
export const selectPostState = (state) => state.post;
export const selectPlaylistState = (state) => state.playlist;
export const selectLikedPlaylists = (state) => state.playlist.likedPlaylists;

export default {
  useAppDispatch,
  useAppSelector,
  selectAuthUser,
  selectPostState,
  selectPlaylistState,
  selectLikedPlaylists,
};
