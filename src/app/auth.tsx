import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { epicService } from '@/services/epicService';

export default function CallbackScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Extract token from deep link redirect (easymedical://auth?token=...)
      const token = searchParams.token as string | undefined;

      if (token) {
        // Token received from backend's OAuth callback - this is the success path
        console.log('Received token from Epic OAuth callback');
        await epicService.handleOAuthCallback(token);

        setLoading(false);
        setTimeout(() => {
          Alert.alert('Success', 'Your Epic account has been connected successfully!');
          router.replace('/');
        }, 500);
        return;
      }

      // Check for error in deep link
      const errorParam = searchParams.error as string | undefined;
      if (errorParam) {
        const errorDescription = searchParams.error_description as string | undefined;
        setError(`Authorization failed: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`);
        setLoading(false);
        return;
      }

      // No token or error received
      setError('No authorization token received');
      setLoading(false);
    } catch (err) {
      console.error('OAuth callback error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Connecting to Epic...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTitle}>Connection Failed</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryText}>Please try again from the Settings screen.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>Redirecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  retryText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
});
