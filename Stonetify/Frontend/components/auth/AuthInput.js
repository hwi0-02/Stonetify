import React from 'react';
import { TextInput, StyleSheet, View } from 'react-native';

const AuthInput = ({ placeholder, value, onChangeText, secureTextEntry = false, style }) => {
  return (
    <View style={[styles.container, style]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#a7a7a7"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        selectionColor="#fff"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginBottom: 15,
  },
  input: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 16,
  },
});

export default AuthInput;