import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  Switch,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useRecords } from '@/context/RecordsContext';

export default function SettingsScreen() {
  const { records } = useRecords();
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [showEpicModal, setShowEpicModal] = useState(false);
  const [epicPatientId, setEpicPatientId] = useState('DEMO123');
  const [epicConnected, setEpicConnected] = useState(false);

  const handleConnectEpic = () => {
    if (epicPatientId.trim()) {
      setEpicConnected(true);
      setShowEpicModal(false);
      Alert.alert('Success', `Connected to Epic account (Patient ID: ${epicPatientId})`);
    } else {
      Alert.alert('Error', 'Please enter a patient ID');
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
          onPress: () => {
            setEpicConnected(false);
            setEpicPatientId('');
            Alert.alert('Disconnected', 'Your Epic account has been disconnected');
          },
          style: 'destructive',
        },
      ]
    );
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
        <Text style={styles.sectionTitle}>Epic EHR Integration</Text>
        <TouchableOpacity
          style={[styles.card, epicConnected && styles.connectedCard]}
          onPress={() => epicConnected ? handleDisconnectEpic() : setShowEpicModal(true)}
        >
          <View style={styles.epicRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.epicTitle}>
                {epicConnected ? '🏥 Epic Account Connected' : '🔗 Connect Epic Account'}
              </Text>
              <Text style={styles.epicSubtitle}>
                {epicConnected
                  ? `Patient ID: ${epicPatientId}`
                  : 'Access medications, appointments & health data'}
              </Text>
            </View>
            <Text style={styles.statusBadge}>
              {epicConnected ? '✓' : '+'}
            </Text>
          </View>
        </TouchableOpacity>
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

      {/* Epic Connection Modal */}
      <Modal
        visible={showEpicModal}
        animationType="slide"
        onRequestClose={() => setShowEpicModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEpicModal(false)}>
              <Text style={styles.closeButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Connect Epic Account</Text>
            <TouchableOpacity onPress={handleConnectEpic}>
              <Text style={styles.connectButton}>Connect</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={styles.modalDescription}>
                Enter your Epic patient ID to access your health records from Epic EHR systems.
              </Text>

              <Text style={styles.inputLabel}>Patient ID</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., DEMO123"
                placeholderTextColor="#CCC"
                value={epicPatientId}
                onChangeText={setEpicPatientId}
              />

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>ℹ️ How to find your Patient ID</Text>
                <Text style={styles.infoText}>
                  Your Patient ID can be found in your Epic patient portal or provided by your healthcare provider.
                </Text>
              </View>

              <View style={styles.securityBox}>
                <Text style={styles.securityTitle}>🔒 Your Privacy</Text>
                <Text style={styles.securityText}>
                  Your patient ID is stored securely on your device. EasyMedical never stores your login credentials.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
