import React, { useEffect, useCallback, useState, useRef } from 'react';
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
  const [displayPosition, setDisplayPosition] = useState(0);
  const [pendingSeekValue, setPendingSeekValue] = useState(null);
  const requestedSeekRef = useRef(null); // preserve target position until backend polling confirms

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
    if (typeof ms !== 'number' || Number.isNaN(ms) || ms < 0) {
      return '0:00';
    }
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? `0${s}` : s}`;
  }, []);

  const safePosition = Number.isFinite(position) ? Math.max(0, position) : 0;
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const sliderValue = seekInProgress && pendingSeekValue !== null ? pendingSeekValue : displayPosition;

  const clampToDuration = useCallback(
    (value) => {
      if (!Number.isFinite(value)) {
        return 0;
      }
      if (safeDuration > 0) {
        return Math.max(0, Math.min(value, safeDuration));
      }
      return Math.max(0, value);
    },
    [safeDuration]
  );

  useEffect(() => {
    if (seekInProgress) {
      return;
    }

    const normalized = clampToDuration(safePosition);
    const pendingTarget = requestedSeekRef.current;

    if (pendingTarget !== null) {
      const diff = Math.abs(normalized - pendingTarget);
      if (diff <= 1000) {
        requestedSeekRef.current = null;
        setPendingSeekValue(null);
        setDisplayPosition(normalized);
      }
      return;
    }

    // 서버 position과 로컬 position 동기화
    setDisplayPosition((prev) => {
      const diff = Math.abs(prev - normalized);

      // 차이가 3초 이상이면 즉시 동기화
      if (diff > 3000) {
        console.log('[PlayerScreen] Large desync detected, syncing:', { prev, normalized, diff });
        return normalized;
      }

      // 차이가 1초 이상이면 서버 position으로 부드럽게 수렴
      if (diff > 1000) {
        // 서버 position 방향으로 조금씩 이동
        const correction = (normalized - prev) * 0.3;
        return prev + correction;
      }

      // 차이가 작으면 그대로 유지 (로컬 틱이 계속 증가시킴)
      return prev;
    });
  }, [safePosition, seekInProgress, clampToDuration]);

  useEffect(() => {
    setDisplayPosition((prev) => clampToDuration(prev));
  }, [safeDuration, clampToDuration]);

  useEffect(() => {
    requestedSeekRef.current = null;
    setPendingSeekValue(null);
    setDisplayPosition(clampToDuration(safePosition));
  }, [currentTrack?.id, clampToDuration, safePosition]);

  useEffect(() => {
    if (!isPlaying || seekInProgress) {
      return;
    }

    console.log('[PlayerScreen] Starting local playback timer, duration:', safeDuration);

    // Locally tick the progress bar between backend status snapshots.
    let lastTick = Date.now();
    const intervalId = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      setDisplayPosition((prev) => {
        // 단순히 이전 값에서 delta만큼 증가
        const next = prev + delta;

        // duration 체크를 여기서 직접 수행
        if (safeDuration > 0 && next > safeDuration) {
          return safeDuration;
        }

        if (next < 0) {
          return 0;
        }

        // 디버깅: 재생바가 멈췄는지 확인
        if (__DEV__ && delta > 0 && Math.abs(next - prev) < 10) {
          console.warn('[PlayerScreen] Display position not updating!', { prev, next, delta, safeDuration });
        }

        return next;
      });
    }, 200);

    return () => {
      console.log('[PlayerScreen] Stopping local playback timer');
      clearInterval(intervalId);
    };
  }, [isPlaying, seekInProgress, safeDuration]);

  const onSlidingStart = () => {
    const normalized = clampToDuration(displayPosition);
    setPendingSeekValue(normalized);
    dispatch(setSeekInProgress(true));
  };

  const onSlidingComplete = async (val) => {
    const clamped = clampToDuration(val);
    requestedSeekRef.current = clamped;
    setPendingSeekValue(clamped);
    setDisplayPosition(clamped);
    dispatch(setSeekInProgress(false));
    try {
      await dispatch(setPosition(Math.floor(clamped))).unwrap();
    } catch (error) {
      console.warn('Seek failed:', error);
      requestedSeekRef.current = null;
      setPendingSeekValue(null);
      setDisplayPosition(clampToDuration(safePosition));
    }
  };

  const handleSliderChange = (val) => {
    const normalized = clampToDuration(val);
    setPendingSeekValue(normalized);
    setDisplayPosition(normalized);
  };

  // 재생 상태 변화 추적
  useEffect(() => {
    if (__DEV__) {
      console.log('[PlayerScreen] State changed:', {
        isPlaying,
        seekInProgress,
        position,
        displayPosition,
        duration,
        currentTrackId: currentTrack?.id
      });
    }
  }, [isPlaying, seekInProgress, position, displayPosition, duration, currentTrack?.id]);

  if (__DEV__) {
    console.log('[PlayerScreen] Render:', { position, duration, isPlaying, seekInProgress });
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

        <View style={styles.songInfoSection}>
          <View style={styles.songDetails}>
            <Text style={styles.title} numberOfLines={1}>{currentTrack.name}</Text>
            <Text style={styles.artist} numberOfLines={1}>{currentTrack.artists}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={safeDuration}
            value={sliderValue}
            minimumTrackTintColor="#fff"
            maximumTrackTintColor="#555"
            thumbTintColor="#fff"
            onSlidingStart={onSlidingStart}
            onValueChange={handleSliderChange}
            onSlidingComplete={onSlidingComplete}
            disabled={!safeDuration}
          />
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatTime(displayPosition)}</Text>
            <Text style={styles.time}>{formatTime(safeDuration)}</Text>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  albumArtContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 30,
  },
  albumArt: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 8,
  },
  loadingIndicator: {
    position: 'absolute',
  },
  songInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  songDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'left',
  },
  artist: {
    fontSize: 16,
    color: '#b3b3b3',
    marginTop: 4,
    textAlign: 'left',
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
