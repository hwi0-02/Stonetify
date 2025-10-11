import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PostCard from '../components/PostCard';
import { fetchSavedPosts, toggleLikePost, toggleSavePost } from '../store/slices/postSlice';

const SavedScreen = () => {
    const navigation = useNavigation();
    const dispatch = useDispatch();
    const { savedPosts, status } = useSelector(state => state.post);

    useFocusEffect(
        useCallback(() => {
            dispatch(fetchSavedPosts());
        }, [dispatch])
    );

    if (status === 'loading' && savedPosts.length === 0) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#1DB954" /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#ffffff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>저장한 피드</Text>
                <View style={{ width: 40 }} />
            </View>
            <FlatList
                data={savedPosts}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <PostCard 
                        item={item}
                        onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.playlist.id })}
                        onLikePress={() => dispatch(toggleLikePost(item.id))}
                        onSavePress={() => dispatch(toggleSavePost(item.id))}
                    />
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>저장한 피드가 없습니다.</Text>
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20, backgroundColor: '#121212' },
    backButton: { padding: 5 },
    headerTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
    listContent: { paddingHorizontal: 16, paddingTop: 16 },
    emptyContainer: { alignItems: 'center', paddingTop: 80 },
    emptyText: { color: '#b3b3b3', fontSize: 16 },
});

export default SavedScreen;