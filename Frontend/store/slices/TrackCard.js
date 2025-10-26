// 예시: TrackCard.js
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleLikeSongThunk, selectIsSongLiked } from '../store/slices/likedSongsSlice';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TrackCard = ({ track }) => {
  const dispatch = useDispatch();
  const isLiked = useSelector(state => selectIsSongLiked(state, track));

  const handleLike = () => {
    dispatch(toggleLikeSongThunk(track));
  };

  return (
    <View style={{ /* ...스타일... */ }}>
      {/* ...트랙 정보 표시... */}
      <TouchableOpacity onPress={handleLike}>
        <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#1DB954" : "#fff"} />
      </TouchableOpacity>
    </View>
  );
};

export default TrackCard;