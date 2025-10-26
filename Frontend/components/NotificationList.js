import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { markAsRead, removeNotification, markAllAsRead } from '../../store/slices/notificationSlice';

const NotificationItem = ({ notification, onRead, onRemove }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'like': return 'heart';
      case 'follow': return 'person-add';
      case 'playlist': return 'musical-notes';
      case 'share': return 'share';
      default: return 'notifications';
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'like': return '#FF6B6B';
      case 'follow': return '#4ECDC4';
      case 'playlist': return '#1DB954';
      case 'share': return '#FFE66D';
      default: return '#ffffff';
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.notificationItem, !notification.read && styles.unread]}
      onPress={() => onRead(notification.id)}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={getIcon(notification.type)} 
          size={24} 
          color={getIconColor(notification.type)} 
        />
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message}>{notification.message}</Text>
        <Text style={styles.timestamp}>
          {new Date(notification.timestamp).toLocaleString('ko-KR')}
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => onRemove(notification.id)}
      >
        <Ionicons name="close" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const NotificationList = () => {
  const dispatch = useDispatch();
  const { notifications, unreadCount } = useSelector(state => state.notification);

  const handleRead = (id) => {
    dispatch(markAsRead(id));
  };

  const handleRemove = (id) => {
    dispatch(removeNotification(id));
  };

  const handleMarkAllRead = () => {
    dispatch(markAllAsRead());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>알림</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllReadButton}>모두 읽음</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>새로운 알림이 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onRead={handleRead}
              onRemove={handleRemove}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  markAllReadButton: {
    color: '#1DB954',
    fontSize: 16,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
    backgroundColor: '#121212',
  },
  unread: {
    backgroundColor: '#1a1a2e',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#282828',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#b3b3b3',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  removeButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
});

export default NotificationList;
