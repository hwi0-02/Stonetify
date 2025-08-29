import React, { useContext } from 'react';
import { View, Text, Button, StyleSheet, SafeAreaView } from 'react-native';
import { AuthContext } from '../context/AuthContext';

const ProfileScreen = () => {
  const { signOut } = useContext(AuthContext);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>프로필</Text>
        <Button title="로그아웃" onPress={signOut} color="#1DB954" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, },
  header: { fontSize: 32, fontWeight: 'bold', color: 'white' },
});

export default ProfileScreen;