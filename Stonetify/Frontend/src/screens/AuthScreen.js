import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';

const AuthScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logoText}>Stonetify</Text>
        <Text style={styles.tagline}>나만의 플레이리스트를 스토너들과 공유해보세요.</Text>
        <TouchableOpacity style={[styles.button, styles.emailButton]} onPress={() => navigation.navigate('Login')}>
          <Text style={[styles.buttonText, styles.emailButtonText]}>이메일로 로그인하기</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footerText}>가입 시, 이용약관 및 개인정보 처리방침에 동의하게 됩니다.</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  logoText: { fontSize: 48, fontWeight: 'bold', color: '#1DB954', marginBottom: 10 },
  tagline: { fontSize: 16, color: '#B3B3B3', marginBottom: 60 },
  button: { width: '90%', paddingVertical: 15, borderRadius: 30, alignItems: 'center' },
  emailButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#B3B3B3' },
  buttonText: { fontSize: 16, fontWeight: 'bold' },
  emailButtonText: { color: '#FFFFFF' },
  footerText: { color: '#B3B3B3', fontSize: 12, textAlign: 'center', padding: 20, paddingBottom: 40 },
});

export default AuthScreen;