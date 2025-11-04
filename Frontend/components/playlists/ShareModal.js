import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Share, 
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useDispatch } from 'react-redux';
import { createShareLinkAsync } from '../../store/slices/playlistSlice';
import ShareStatsModal from './ShareStatsModal';

const ShareModal = ({ visible, onClose, playlist }) => {
  const dispatch = useDispatch();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);

  const generateShareLink = async () => {
    setLoading(true);
    try {
      const result = await dispatch(createShareLinkAsync(playlist.id));
      if (result.payload) {
        setShareData(result.payload);
      }
    } catch (error) {
      Alert.alert('오류', '공유 링크 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareData?.share_url) {
      await Clipboard.setStringAsync(shareData.share_url);
      Alert.alert('복사 완료', '링크가 클립보드에 복사되었습니다.');
    }
  };

  const handleNativeShare = async () => {
    if (shareData?.share_url) {
      try {
        await Share.share({
          message: `🎵 Stonetify에서 "${playlist.title}" 플레이리스트를 확인해보세요!\n\n${shareData.share_url}`,
          url: shareData.share_url,
          title: `${playlist.title} - Stonetify`,
        });
      } catch (error) {
        console.error('공유 실패:', error);
      }
    }
  };

  const getSocialMessage = (platform) => {
    const baseMessage = `🎵 "${playlist.title}" 플레이리스트를 공유합니다!`;
    const hashtags = '#Stonetify #플레이리스트 #음악공유';

    switch (platform) {
      case 'twitter':
        return `${baseMessage} ${shareData?.share_url} ${hashtags}`;
      case 'facebook':
        return `${baseMessage}\n\n${shareData?.share_url}`;
      case 'instagram':
        return `${baseMessage}\n링크는 바이오에서 확인하세요! ${hashtags}`;
      default:
        return `${baseMessage}\n${shareData?.share_url}`;
    }
  };

  React.useEffect(() => {
    if (visible && playlist && !shareData) {
      generateShareLink();
    }
  }, [visible, playlist]);

  const handleClose = () => {
    setShareData(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>플레이리스트 공유</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <View style={styles.playlistInfo}>
            <Text style={styles.playlistTitle}>{playlist?.title}</Text>
            <Text style={styles.playlistCreator}>By {playlist?.user?.display_name}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1DB954" />
              <Text style={styles.loadingText}>공유 링크 생성 중...</Text>
            </View>
          ) : shareData ? (
            <View style={styles.shareContent}>
              <View style={styles.qrContainer}>
                <Text style={styles.qrTitle}>QR 코드로 공유</Text>
                <Image source={{ uri: shareData.qr_code_url }} style={styles.qrCode} />
                <Text style={styles.qrSubtext}>QR 코드를 스캔하여 바로 접속</Text>
              </View>

              <View style={styles.shareOptions}>
                <TouchableOpacity style={styles.shareOption} onPress={copyToClipboard}>
                  <Ionicons name="copy-outline" size={24} color="#1DB954" />
                  <Text style={styles.shareOptionText}>링크 복사</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption} onPress={handleNativeShare}>
                  <Ionicons name="share-outline" size={24} color="#1DB954" />
                  <Text style={styles.shareOptionText}>앱으로 공유</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.shareOption} 
                  onPress={() => Share.share({ message: getSocialMessage('twitter') })}
                >
                  <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                  <Text style={styles.shareOptionText}>트위터</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.shareOption}
                  onPress={() => Share.share({ message: getSocialMessage('facebook') })}
                >
                  <Ionicons name="logo-facebook" size={24} color="#4267B2" />
                  <Text style={styles.shareOptionText}>페이스북</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.shareInfo}>
                <View style={styles.shareInfoRow}>
                  <Text style={styles.shareInfoText}>
                    공유된 날짜: {new Date(shareData.created_at).toLocaleDateString('ko-KR')}
                  </Text>
                  <TouchableOpacity 
                    style={styles.statsButton} 
                    onPress={() => setStatsModalVisible(true)}
                  >
                    <Ionicons name="analytics-outline" size={16} color="#1DB954" />
                    <Text style={styles.statsButtonText}>통계</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.shareUrl} numberOfLines={1}>
                  {shareData.share_url}
                </Text>
                
                {shareData.view_count !== undefined && (
                  <View style={styles.shareStats}>
                    <Text style={styles.shareStatsText}>
                      조회수: {shareData.view_count} • 공유수: {shareData.share_count}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
              <Text style={styles.errorText}>공유 링크 생성에 실패했습니다</Text>
              <TouchableOpacity style={styles.retryButton} onPress={generateShareLink}>
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
        <ShareStatsModal 
          visible={statsModalVisible}
          onClose={() => setStatsModalVisible(false)}
          playlistId={playlist?.id}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  playlistTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  playlistCreator: {
    color: '#b3b3b3',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#b3b3b3',
    marginTop: 12,
    fontSize: 16,
  },
  shareContent: {
    padding: 20,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  qrTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  qrCode: {
    width: 150,
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  qrSubtext: {
    color: '#b3b3b3',
    fontSize: 12,
    textAlign: 'center',
  },
  shareOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  shareOption: {
    width: '48%',
    backgroundColor: '#282828',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  shareOptionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  shareInfo: {
    backgroundColor: '#282828',
    padding: 15,
    borderRadius: 12,
  },
  shareInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareInfoText: {
    color: '#b3b3b3',
    fontSize: 12,
    flex: 1,
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statsButtonText: {
    color: '#1DB954',
    fontSize: 11,
    fontWeight: '600',
  },
  shareUrl: {
    color: '#1DB954',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  shareStats: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#404040',
  },
  shareStatsText: {
    color: '#b3b3b3',
    fontSize: 11,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ShareModal;
