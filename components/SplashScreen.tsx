import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Ionicons size={200} />
      <Text style={styles.title}>AG TUR</Text>
      <Text style={styles.subtitle}>Sua viagem começa aqui</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFC107',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 18,
    color: '#1A1A1A',
    marginTop: 10,
  },
});

export default SplashScreen;
