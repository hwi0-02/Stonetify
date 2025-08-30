import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Image, View } from 'react-native';

// 로그인/회원가입 화면에서 사용하는 버튼 컴포넌트
const AuthButton = ({ title, onPress, style, textStyle, icon }) => {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      {icon && <Image source={icon} style={styles.icon} />}
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 30,
    backgroundColor: '#8E44AD',
    shadowColor: '#8E44AD',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 200,
  },
  icon: {
    width: 20,
    height: 20,
    contentFit: 'contain',
    marginRight: 12,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default AuthButton;