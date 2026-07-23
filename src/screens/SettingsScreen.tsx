import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useRecords } from '@/context/RecordsContext';

export default function SettingsScreen() {
  const { records } = useRecords();
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);

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
            // TODO: Implement clear all functionality
            Alert.alert('Coming Soon', 'Clear all functionality coming in next update');
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
        <Text style={styles.appName}>EasyMedical</Text>
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
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.card}>
          <View style={styles.featureRow}>
            <View>
              <Text style={styles.featureTitle}>Cloud Backup (Coming Soon)</Text>
              <Text style={styles.featureSubtitle}>
                Sync your records across devices
              </Text>
            </View>
            <Switch
              value={cloudSyncEnabled}
              onValueChange={setCloudSyncEnabled}
              disabled={true}
            />
          </View>
        </View>
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
            EasyMedical helps you organize and understand your medical records in one place.
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
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 12,
    color: '#999',
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
});
