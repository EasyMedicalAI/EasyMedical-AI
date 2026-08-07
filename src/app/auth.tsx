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
      console.log('🔍 Auth route called, searchParams:', searchParams);

      // Extract authorization code from deep link (easymedical://auth?code=...)
      const code = searchParams.code as string | undefined;
      const token = searchParams.token as string | undefined;

      console.log('🔍 Code from deep link:', code ? '✅ received' : '❌ not found');
      console.log('🔍 Token from deep link:', token ? '✅ received' : '❌ not found');

      // New flow: exchange code for token
      if (code) {
        console.log('✅ Received auth code, exchanging for token...');
        try {
          const backendUrl = 'https://easymedical-backend-new-production.up.railway.app';
          const response = await fetch(`${backendUrl}/api/auth/epic/token/${code}`);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to exchange auth code');
          }

          const tokenData = await response.json();
          const accessToken = tokenData.access_token;

          if (!accessToken) {
            throw new Error('No access token in response');
          }

          console.log('✅ Token received from backend, saving...');
          await epicService.handleOAuthCallback(accessToken);
          console.log('✅ Token saved successfully');

          setLoading(false);
          setTimeout(() => {
            Alert.alert('Success', 'Your Epic account has been connected successfully!');
            router.replace('/');
          }, 500);
          return;
        } catch (codeExchangeErr) {
          console.error('❌ Error exchanging code for token:', codeExchangeErr);
          setError(codeExchangeErr instanceof Error ? codeExchangeErr.message : 'Failed to complete authentication');
          setLoading(false);
          return;
        }
      }

      // Fallback: old flow with direct token (for backwards compatibility)
      if (token) {
        console.log('✅ Received token directly from Epic OAuth callback, saving...');
        await epicService.handleOAuthCallback(token);
        console.log('✅ Token saved successfully');

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
        const errorMsg = `Authorization failed: ${errorParam}${errorDescription ? ` - ${errorDescription}` : ''}`;
        console.log('❌ OAuth error:', errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // No code, token, or error received
      console.log('❌ No code, token, or error in deep link');
      setError('No authorization code received');
      setLoading(false);
    } catch (err) {
      console.error('❌ OAuth callback error:', err);
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
