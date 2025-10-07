import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import { showToast } from '../utils/toast';
import { useDispatch } from 'react-redux';
import { setPlaybackDeviceInfo } from '../store/slices/playerSlice';

const DevicePicker = ({ visible, onClose, onPicked }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setLoading(true);
      try {
        const userRaw = await AsyncStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        const uid = user?.id || user?.userId;
        setUserId(uid);
        if (!uid) throw new Error('사용자 정보를 찾을 수 없습니다.');
        const data = await apiService.getRemoteDevices(uid);
        setDevices(data?.devices || []);
      } catch (e) {
        showToast('기기 목록을 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible]);

  const selectDevice = async (device) => {
    try {
      if (!userId) return;
      await apiService.transferRemotePlayback({ userId, device_id: device.id, play: true });
      showToast(`재생 기기 전환: ${device.name}`);
      dispatch(setPlaybackDeviceInfo({ id: device.id, name: device.name }));
      onPicked?.(device);
      onClose?.();
    } catch (e) {
      showToast('기기 전환에 실패했습니다.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>기기 선택</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>닫기</Text></TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color="#1DB954" style={{ margin: 16 }} />
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.item} onPress={() => selectDevice(item)}>
                  <View>
                    <Text style={styles.itemName}>{item.name || 'Unknown device'}</Text>
                    <Text style={styles.itemMeta}>{item.type} • {item.is_active ? 'Active' : 'Inactive'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>사용 가능한 기기가 없습니다.</Text>}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#181818', paddingTop: 12, paddingBottom: 24, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600' },
  close: { color: '#b3b3b3', fontSize: 14 },
  item: { paddingHorizontal: 16, paddingVertical: 14, borderBottomColor: '#2a2a2a', borderBottomWidth: StyleSheet.hairlineWidth },
  itemName: { color: '#fff', fontSize: 15, marginBottom: 2 },
  itemMeta: { color: '#b3b3b3', fontSize: 12 },
  empty: { color: '#b3b3b3', padding: 16, textAlign: 'center' },
});

export default DevicePicker;
