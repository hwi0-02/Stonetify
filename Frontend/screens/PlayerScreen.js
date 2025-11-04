import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator, BackHandler, Modal, FlatList } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { pauseTrack, resumeTrack, stopTrack, nextTrack, previousTrack, toggleRepeat, toggleShuffle, setSeekInProgress, setPosition, setPlayerScreenVisible } from '../store/slices/playerSlice';
import { useFocusEffect } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import * as ApiService from '../services/apiService';

const { width } = Dimensions.get('window');
const placeholderAlbum = require('../assets/images/placeholder_album.png');

const PlayerScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const { currentTrack, isPlaying, status, position, duration, repeatMode, isShuffle, seekInProgress } = useSelector((state) => state.player);
  const { user } = useSelector((state) => state.auth);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [loadingDevices, setLoadingDevices] = useState(false);

  useEffect(() => {
    if (!currentTrack) {
      navigation.goBack();
    }
  }, [currentTrack, navigation]);

  useFocusEffect(
    useCallback(() => {
      dispatch(setPlayerScreenVisible(true));

      const onBackPress = () => {
        navigation.goBack();
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        dispatch(setPlayerScreenVisible(false));
        backHandler.remove();
      };
    }, [dispatch, navigation])
  );

  const handleClose = () => {
    navigation.goBack();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      dispatch(pauseTrack());
    } else {
      dispatch(resumeTrack());
    }
  };

  const handleNext = () => dispatch(nextTrack());
  const handlePrev = () => dispatch(previousTrack());
  const handleRepeat = () => dispatch(toggleRepeat());
  const handleShuffle = () => dispatch(toggleShuffle());

  const fetchDevices = async () => {
    if (!user?.id) return;
    try {
      setLoadingDevices(true);
      const data = await ApiService.getRemoteDevices(user.id);
      setDevices(data?.devices || []);
      const active = data?.devices?.find(d => d.is_active);
      setSelectedDevice(active || data?.devices?.[0] || null);
    } catch (error) {
      console.error('디바이스 조회 실패:', error);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleSelectDevice = async (device) => {
    if (!user?.id) return;
    try {
      await ApiService.transferRemotePlayback({
        userId: user.id,
        device_id: device.id,
        play: isPlaying,
      });
      setSelectedDevice(device);
      setDeviceModalVisible(false);
    } catch (error) {
      console.error('디바이스 전환 실패:', error);
    }
  };

  const formatTime = useCallback((ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0'+s : s}`;
  }, []);

  const onSlidingStart = () => dispatch(setSeekInProgress(true));
  const onSlidingComplete = (val) => {
    dispatch(setSeekInProgress(false));
    dispatch(setPosition(Math.floor(val)));
  };

  if (__DEV__) {
    console.log('[PlayerScreen]', { position, duration, repeatMode, isShuffle, seekInProgress });
  }

  if (!currentTrack) {
    return (
        <View style={styles.container} />
    );
  }

  return (
    <>
    <LinearGradient colors={['#4c1e6e', '#121212']} style={styles.container}>
      <TouchableOpacity onPress={handleClose} style={styles.downButton}>
        <Ionicons name="chevron-down" size={32} color="white" />
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => { fetchDevices(); setDeviceModalVisible(true); }} style={styles.deviceButton}>
        <Ionicons name="radio" size={24} color="#1DB954" />
        <Text style={styles.deviceButtonText}>{selectedDevice?.name || '디바이스'}</Text>
      </TouchableOpacity>
      
      <View style={styles.content}>
        <View style={styles.albumArtContainer}>
            <Image 
                source={currentTrack.album_cover_url ? { uri: currentTrack.album_cover_url } : placeholderAlbum} 
                style={styles.albumArt} 
            />
            {status === 'loading' && (
                <ActivityIndicator style={styles.loadingIndicator} size="large" color="#fff" />
            )}
        </View>

        <View style={styles.songDetails}>
          <Text style={styles.title}>{currentTrack.name}</Text>
          <Text style={styles.artist}>{currentTrack.artists}</Text>
        </View>

        <View style={styles.progressSection}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={duration || 0}
            value={position}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="#555"
            thumbTintColor="#fff"
            onSlidingStart={onSlidingStart}
            onSlidingComplete={onSlidingComplete}
            disabled={!duration}
          />
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(position)}</Text>
            <Text style={styles.time}>{formatTime(duration)}</Text>
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity onPress={handleShuffle} style={styles.smallBtn}>
            <Ionicons name="shuffle" size={26} color={isShuffle ? '#1DB954' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePrev} style={styles.smallBtn}>
            <Ionicons name="play-skip-back" size={40} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePlayPause} disabled={status === 'loading'}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={88}
              color={status === 'loading' ? '#555' : '#fff'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleNext} style={styles.smallBtn}>
            <Ionicons name="play-skip-forward" size={40} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRepeat} style={styles.smallBtn}>
            <Ionicons
              name={repeatMode === 'track' ? 'repeat' : repeatMode === 'queue' ? 'repeat' : 'repeat'}
              size={26}
              color={repeatMode !== 'off' ? '#1DB954' : '#fff'}
            />
            {repeatMode === 'track' && <View style={styles.repeatOneBadge}><Text style={styles.repeatOneText}>1</Text></View>}
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>

    <Modal visible={deviceModalVisible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>재생 기기 선택</Text>
            <TouchableOpacity onPress={() => setDeviceModalVisible(false)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {loadingDevices ? (
            <ActivityIndicator size="large" color="#1DB954" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.deviceItem,
                    selectedDevice?.id === item.id && styles.deviceItemSelected,
                  ]}
                  onPress={() => handleSelectDevice(item)}
                >
                  <Ionicons
                    name={item.type === 'Smartphone' ? 'phone-portrait' : 'desktop'}
                    size={24}
                    color={selectedDevice?.id === item.id ? '#1DB954' : '#fff'}
                  />
                  <View style={styles.deviceItemText}>
                    <Text style={styles.deviceItemName}>{item.name}</Text>
                    <Text style={styles.deviceItemType}>{item.type}</Text>
                  </View>
                  {item.is_active && <Ionicons name="checkmark-circle" size={24} color="#1DB954" />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  downButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1,
  },
  deviceButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  deviceButtonText: {
    color: '#1DB954',
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  albumArtContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumArt: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 12,
    marginBottom: 60,
  },
  loadingIndicator: {
    position: 'absolute',
  },
  songDetails: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  artist: {
    fontSize: 18,
    color: '#b3b3b3',
    marginTop: 8,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
  },
  progressSection: { width: '100%', marginBottom: 20 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  time: { color: '#bbb', fontSize: 12 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 10, position: 'relative' },
  repeatOneBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#1DB954', borderRadius: 8, paddingHorizontal: 4 },
  repeatOneText: { color: '#000', fontSize: 10, fontWeight: '700' },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#282828',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  deviceItemSelected: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  deviceItemText: {
    flex: 1,
    marginLeft: 16,
  },
  deviceItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  deviceItemType: {
    fontSize: 12,
    color: '#b3b3b3',
    marginTop: 4,
  },
});

export default PlayerScreen;
