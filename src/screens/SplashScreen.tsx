import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
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
          <View style={styles.logo}>
            {/* Outer rings */}
            <View style={[styles.ring, styles.ring1]} />
            <View style={[styles.ring, styles.ring2]} />

            {/* Folder shape */}
            <View style={styles.folder}>
              {/* Folder tab */}
              <View style={styles.folderTab} />
              {/* Folder body */}
              <View style={styles.folderBody} />
            </View>

            {/* Medical cross */}
            <View style={styles.crossContainer}>
              <View style={styles.crossVertical} />
              <View style={styles.crossHorizontal} />
            </View>
          </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.2,
    borderColor: '#1e40af',
  },
  ring1: {
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.3,
  },
  ring2: {
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.5,
  },
  folder: {
    width: 70,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  folderTab: {
    position: 'absolute',
    top: -8,
    left: 0,
    width: 30,
    height: 16,
    backgroundColor: '#1e40af',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  folderBody: {
    width: 70,
    height: 55,
    backgroundColor: '#1e40af',
    borderRadius: 8,
    borderTopLeftRadius: 4,
  },
  crossContainer: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossVertical: {
    position: 'absolute',
    width: 6,
    height: 28,
    backgroundColor: '#1e3a8a',
    borderRadius: 3,
  },
  crossHorizontal: {
    position: 'absolute',
    width: 28,
    height: 6,
    backgroundColor: '#1e3a8a',
    borderRadius: 3,
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
