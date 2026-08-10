import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRecords } from '@/context/RecordsContext';
import { epicService } from '@/services/epicService';

export default function SettingsScreen() {
  const { records, clearAllData, syncWithEpic } = useRecords();
  const [showEpicModal, setShowEpicModal] = useState(false);
  const [epicConnected, setEpicConnected] = useState(false);
  const [epicLoading, setEpicLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkEpicConnection();
  }, []);

  const checkEpicConnection = async () => {
    const connected = await epicService.isConnected();
    setEpicConnected(connected);
  };

  const handleConnectEpic = async () => {
    try {
      setEpicLoading(true);
      const authUrl = await epicService.generateAuthorizationUrl();

      if (Platform.OS === 'web') {
        // For web, use window.open to open the OAuth URL
        if (typeof window !== 'undefined') {
          window.open(authUrl, '_blank');
        }
      } else {
        // For native mobile, use WebBrowser
        console.log('Opening browser for Epic OAuth...');
        const result = await WebBrowser.openBrowserAsync(authUrl);
        console.log('Browser closed, result type:', result.type);

        // Browser closed - either user cancelled or deep link was triggered
        // Wait for deep link handler to process the token
        setTimeout(async () => {
          console.log('Checking Epic connection status...');
          const connected = await epicService.isConnected();
          console.log('Connected to Epic:', connected);
          setEpicConnected(connected);
          if (connected) {
            Alert.alert('Success', 'Your Epic account has been connected successfully!');
          } else {
            console.log('Not connected yet, checking if there was an error');
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error connecting to Epic:', error);
      Alert.alert('Error', 'Failed to connect to Epic. Please try again.');
    } finally {
      setEpicLoading(false);
    }
  };

  const handleDisconnectEpic = () => {
    Alert.alert(
      'Disconnect Epic Account',
      'Are you sure you want to disconnect your Epic account?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Disconnect',
          onPress: async () => {
            await epicService.disconnect();
            setEpicConnected(false);
            Alert.alert('Disconnected', 'Your Epic account has been disconnected');
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleSyncEpic = async () => {
    try {
      setSyncing(true);
      const result = await syncWithEpic();

      Alert.alert(
        'Sync Complete',
        `✅ Added ${result.added} records from Epic\n⏭️ Skipped ${result.duplicates} duplicates\n\nYour local records are preserved.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Sync Failed',
        'Error syncing with Epic: ' + String(error)
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all stored records. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          onPress: () => {},
        },
        {
          text: 'Clear All',
          onPress: async () => {
            try {
              await clearAllData();
              Alert.alert('Success', 'All data has been cleared.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data: ' + String(error));
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.topBar}>
        <View />
        <Text style={styles.appName}>EasyMedical AI</Text>
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Stored Records</Text>
            <Text style={styles.value}>{records.length}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>App Version</Text>
            <Text style={styles.value}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Storage</Text>
            <Text style={styles.value}>Local Device</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Epic EHR Integration</Text>
        <TouchableOpacity
          style={[styles.card, epicConnected && styles.connectedCard]}
          onPress={() => epicConnected ? handleDisconnectEpic() : handleConnectEpic()}
          disabled={epicLoading}
        >
          <View style={styles.epicRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.epicTitle}>
                {epicConnected ? '🏥 Epic Account Connected' : '🔗 Connect Epic Account'}
              </Text>
              <Text style={styles.epicSubtitle}>
                {epicConnected
                  ? 'Access your health data from Epic EHR'
                  : 'Access medications, appointments & health data'}
              </Text>
            </View>
            {epicLoading ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.statusBadge}>
                {epicConnected ? '✓' : '+'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {epicConnected && (
          <TouchableOpacity
            style={[styles.card, styles.syncButton]}
            onPress={handleSyncEpic}
            disabled={syncing}
          >
            <View style={styles.epicRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.syncTitle}>
                  🔄 Sync Records from Epic
                </Text>
                <Text style={styles.syncSubtitle}>
                  Import appointments, labs & conditions
                </Text>
              </View>
              {syncing ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.syncIcon}>→</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        <TouchableOpacity style={styles.card} onPress={handleClearAllData}>
          <Text style={styles.deleteText}>🗑️ Clear All Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <Text style={styles.aboutText}>
            EasyMedical AI helps you organize and understand your medical records in one place.
          </Text>
          <Text style={styles.aboutSubtext}>
            All records are stored securely on your device.
          </Text>
        </View>
      </View>

      <View style={styles.spacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  header: {
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#000',
    fontWeight: '600',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3333',
    textAlign: 'center',
  },
  aboutText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  aboutSubtext: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
  spacing: {
    height: 100,
  },
  epicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  epicTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  epicSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  connectedCard: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  statusBadge: {
    fontSize: 24,
    color: '#007AFF',
    fontWeight: '600',
  },
  syncButton: {
    marginTop: 12,
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  syncSubtitle: {
    fontSize: 12,
    color: '#0051BA',
  },
  syncIcon: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  connectButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingVertical: 20,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    marginBottom: 24,
    backgroundColor: '#FAFAFA',
  },
  infoBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  securityBox: {
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#27AE60',
  },
  securityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#27AE60',
    marginBottom: 4,
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});
