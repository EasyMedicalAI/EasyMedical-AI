import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      onFinish?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [fadeAnim, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
          />
        </View>

        {/* App Name */}
        <Text style={styles.appName}>EasyMedical AI</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Your central medical hub</Text>

        {/* Loading indicator */}
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#1e40af" />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    fontWeight: '400',
    marginBottom: 48,
  },
  loaderContainer: {
    marginTop: 12,
  },
});
