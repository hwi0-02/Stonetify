import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch } from 'react-redux';
import * as apiService from '../../services/apiService';

// 플레이리스트 공유 통계 컴포넌트
const ShareStatsModal = ({ visible, onClose, playlistId }) => {
  const [shareStats, setShareStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchShareStats = async () => {
    if (!playlistId) return;
    
    setLoading(true);
    try {
      const stats = await apiService.getShareStats(playlistId);
      setShareStats(stats);
    } catch (error) {
      console.error('공유 통계 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && playlistId) {
      fetchShareStats();
    }
  }, [visible, playlistId]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>공유 통계</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1DB954" />
            <Text style={styles.loadingText}>통계를 불러오는 중...</Text>
          </View>
        ) : shareStats ? (
          <ScrollView style={styles.content}>
            {/* 전체 통계 */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="eye-outline" size={32} color="#1DB954" />
                <Text style={styles.statNumber}>{shareStats.total_views || 0}</Text>
                <Text style={styles.statLabel}>총 조회수</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="share-outline" size={32} color="#1DB954" />
                <Text style={styles.statNumber}>{shareStats.total_shares || 0}</Text>
                <Text style={styles.statLabel}>총 공유수</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="heart-outline" size={32} color="#1DB954" />
                <Text style={styles.statNumber}>{shareStats.total_likes || 0}</Text>
                <Text style={styles.statLabel}>받은 좋아요</Text>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="calendar-outline" size={32} color="#1DB954" />
                <Text style={styles.statNumber}>{shareStats.days_active || 0}</Text>
                <Text style={styles.statLabel}>활성 일수</Text>
              </View>
            </View>

            {/* 일별 통계 */}
            {shareStats.daily_stats && shareStats.daily_stats.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>최근 7일 통계</Text>
                {shareStats.daily_stats.map((day, index) => (
                  <View key={index} style={styles.dailyStatRow}>
                    <Text style={styles.dailyDate}>{day.date}</Text>
                    <View style={styles.dailyNumbers}>
                      <Text style={styles.dailyView}>조회 {day.views}</Text>
                      <Text style={styles.dailyShare}>공유 {day.shares}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 공유 방법별 통계 */}
            {shareStats.share_methods && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>공유 방법별 통계</Text>
                {Object.entries(shareStats.share_methods).map(([method, count]) => (
                  <View key={method} style={styles.methodRow}>
                    <View style={styles.methodInfo}>
                      <Ionicons 
                        name={getMethodIcon(method)} 
                        size={20} 
                        color="#1DB954" 
                      />
                      <Text style={styles.methodName}>{getMethodName(method)}</Text>
                    </View>
                    <Text style={styles.methodCount}>{count}회</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 인기 시간대 */}
            {shareStats.popular_hours && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>인기 시간대</Text>
                <Text style={styles.popularTime}>
                  가장 많이 공유되는 시간: {shareStats.popular_hours.peak_hour}시
                </Text>
                <Text style={styles.popularTimeDesc}>
                  {shareStats.popular_hours.description}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>아직 공유 통계가 없습니다</Text>
            <Text style={styles.emptySubtext}>플레이리스트를 공유하여 통계를 확인해보세요</Text>
          </View>
        )}
      </View>
    </View>
  );
};

// 공유 방법별 아이콘 반환
const getMethodIcon = (method) => {
  const icons = {
    link: 'link-outline',
    qr: 'qr-code-outline',
    social: 'share-social-outline',
    message: 'chatbubble-outline',
    email: 'mail-outline',
  };
  return icons[method] || 'share-outline';
};

// 공유 방법별 이름 반환
const getMethodName = (method) => {
  const names = {
    link: '링크 복사',
    qr: 'QR 코드',
    social: 'SNS 공유',
    message: '메시지',
    email: '이메일',
  };
  return names[method] || method;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#b3b3b3',
    marginTop: 12,
  },
  content: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#282828',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    color: '#b3b3b3',
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  dailyStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dailyDate: {
    color: '#ffffff',
    fontSize: 14,
  },
  dailyNumbers: {
    flexDirection: 'row',
    gap: 15,
  },
  dailyView: {
    color: '#1DB954',
    fontSize: 12,
  },
  dailyShare: {
    color: '#ff6b6b',
    fontSize: 12,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  methodName: {
    color: '#ffffff',
    fontSize: 14,
  },
  methodCount: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  popularTime: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  popularTimeDesc: {
    color: '#b3b3b3',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtext: {
    color: '#b3b3b3',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default ShareStatsModal;
