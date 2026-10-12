import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ehrService } from '../services/ehrService';

export function CallbackScreen() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Extract code and state from URL parameters
      const code = searchParams.code as string | undefined;
      const state = searchParams.state as string | undefined;

      if (!code) {
        // Check if user denied access
        const errorParam = searchParams.error as string | undefined;
        if (errorParam) {
          setError(`Authorization denied: ${errorParam}`);
        } else {
          setError('No authorization code received');
        }
        setLoading(false);
        return;
      }

      // Exchange code for access token
      await ehrService.exchangeCodeForToken(code, state);

      // Success! Navigate to home
      setLoading(false);
      setTimeout(() => {
        router.replace('/');
      }, 1500);
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
