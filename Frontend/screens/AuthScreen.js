import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import AuthButton from '../components/AuthButton';

// 로고 이미지를 assets 폴더에 넣어주세요.
// 예: 'assets/images/logo.png'
// const logo = require('../../assets/images/logo.png'); 

const AuthScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* <Image source={logo} style={styles.logo} /> */}
        <Text style={styles.title}>Stonetify</Text>
        <Text style={styles.subtitle}>나만의 플레이리스트를 공유하고 발견하세요</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <AuthButton 
          title="로그인" 
          onPress={() => navigation.navigate('Login')} 
        />
        <AuthButton 
          title="회원가입" 
          onPress={() => navigation.navigate('SignUp')}
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#1DB954' }}
          textStyle={{ color: '#1DB954' }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    marginTop: 100,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1DB954',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  buttonContainer: {
    width: '100%',
    marginBottom: 50,
  }
});

export default AuthScreen;