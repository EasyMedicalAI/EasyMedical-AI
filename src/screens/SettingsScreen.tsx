import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRecords } from '@/context/RecordsContext';
import { ehrService, EhrSystem } from '@/services/ehrService';
import { ScreenHeader, Section, ListCard, ListRow, Divider, DetailPage } from '@/components/ScreenKit';

export default function SettingsScreen() {
  const { records, clearAllData, syncWithEHR, profileBackups, restoreProfileBackup } = useRecords();
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [backups, setBackups] = useState<{ savedAt: string; profile: any }[]>([]);
  const [systems, setSystems] = useState<EhrSystem[]>([]);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [expiredIds, setExpiredIds] = useState<string[]>([]);
  const [busySystemId, setBusySystemId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadSystems();
  }, []);

  const refreshConnections = async () => {
    const connections = await ehrService.getConnections();
    setConnectedIds(connections.map((c) => c.systemId));
    setExpiredIds(await ehrService.getExpiredSystemIds());
  };

  const loadSystems = async () => {
    try {
      setSystems(await ehrService.listSystems());
    } catch (error) {
      console.error('Could not load EHR systems:', error);
    }
    await refreshConnections();
  };

  const handleConnect = async (system: EhrSystem) => {
    try {
      setBusySystemId(system.id);

      // Get authorization URL and state from backend
      const { url: authUrl, state } = await ehrService.generateAuthorizationUrl(system.id);

      if (Platform.OS === 'web') {
        // For web, use window.open to open the OAuth URL
        if (typeof window !== 'undefined') {
          window.open(authUrl, '_blank');
        }
        return;
      }

      // For native mobile, use WebBrowser, then pick up the token by state once it closes
      await WebBrowser.openBrowserAsync(authUrl);
      const connection = await ehrService.retrieveTokenByState(state);

      if (connection) {
        await ehrService.saveConnection(connection);
        await refreshConnections();
        Alert.alert('Connected', `Your ${system.name} account has been connected.`);
      } else {
        Alert.alert('Authorization Cancelled', `${system.name} authorization was cancelled or timed out.`);
      }
    } catch (error) {
      console.error(`Error connecting to ${system.name}:`, error);
      Alert.alert('Error', `Failed to connect to ${system.name}. Please try again.`);
    } finally {
      setBusySystemId(null);
    }
  };

  const handleDisconnect = (system: EhrSystem) => {
    Alert.alert(
      `Disconnect ${system.name}`,
      `Stop syncing your ${system.name} records? Records already imported stay on this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await ehrService.disconnect(system.id);
            await refreshConnections();
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await syncWithEHR();
      Alert.alert(
        'Sync Complete',
        `✅ Added ${result.added} records\n⏭️ Skipped ${result.duplicates} duplicates\n\nYour local records are preserved.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Sync Failed', 'Error syncing records: ' + String(error));
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="Settings" />

      <Section title="App information">
        <ListCard>
          <ListRow icon="database-outline" label="Stored records" value={String(records.length)} />
          <Divider />
          <ListRow icon="information-outline" label="App version" value="1.0.0" />
          <Divider />
          <ListRow icon="harddisk" label="Storage" value="Local device" />
        </ListCard>
      </Section>

      <Section title="Health record connections">
        {systems.length === 0 && (
          <Text style={styles.note}>Couldn't load health systems. Check your connection and reopen Settings.</Text>
        )}
        <ListCard>
          {systems.map((system, index) => {
            const connected = connectedIds.includes(system.id);
            const expired = expiredIds.includes(system.id);
            const busy = busySystemId === system.id;
            const unavailable = !system.configured;
            const status = busy
              ? 'Connecting…'
              : unavailable
              ? 'Not available'
              : connected && !expired
              ? 'Connected'
              : expired
              ? 'Sign-in expired'
              : 'Connect';
            const hint = unavailable
              ? 'Not available yet'
              : expired
              ? 'Tap to reconnect'
              : connected
              ? 'Tap to disconnect'
              : 'Your patient portal account';
            return (
              <React.Fragment key={system.id}>
                {index > 0 && <Divider />}
                <ListRow
                  icon="hospital-building"
                  label={system.name}
                  hint={hint}
                  value={status}
                  onPress={unavailable || busy ? undefined : () => (connected && !expired ? handleDisconnect(system) : handleConnect(system))}
                />
              </React.Fragment>
            );
          })}
          {connectedIds.length > 0 && (
            <>
              {systems.length > 0 && <Divider />}
              <ListRow
                icon="sync"
                label="Sync records"
                hint="Import labs, medications & conditions from all connected systems"
                value={syncing ? 'Syncing…' : undefined}
                onPress={syncing ? undefined : handleSync}
              />
            </>
          )}
        </ListCard>
      </Section>

      <Section title="Data management">
        <ListCard>
          <ListRow
            icon="backup-restore"
            label="Restore an earlier profile"
            hint="Undo a save by choosing a copy of your profile from before it"
            onPress={async () => {
              setBackups(await profileBackups());
              setBackupsOpen(true);
            }}
          />
          <Divider />
          <ListRow icon="trash-can-outline" label="Clear all data" danger onPress={handleClearAllData} />
        </ListCard>
      </Section>

      <Section title="About">
        <ListCard>
          <View style={styles.aboutBlock}>
            <Text style={styles.aboutText}>EasyMedical AI helps you organize and understand your medical records in one place.</Text>
            <Text style={styles.aboutSubtext}>All records are stored securely on your device.</Text>
          </View>
        </ListCard>
      </Section>

      <View style={styles.spacing} />

      <DetailPage visible={backupsOpen} title="Earlier profiles" onClose={() => setBackupsOpen(false)}>
        <View style={styles.pagePadding}>
          <Text style={styles.note}>
            A copy is saved before each change. Restoring one replaces your current profile, and the current one is saved as a copy too.
          </Text>
          {backups.length === 0 && <Text style={styles.note}>No earlier copies yet.</Text>}
          {backups.length > 0 && (
            <ListCard>
              {backups.map((b, index) => (
                <React.Fragment key={b.savedAt}>
                  {index > 0 && <Divider />}
                  <ListRow
                    icon="history"
                    label={new Date(b.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    value="Restore"
                    onPress={() =>
                      Alert.alert('Restore this profile?', 'Your current profile will be replaced. The current one is saved as a copy first.', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Restore',
                          onPress: async () => {
                            try {
                              await restoreProfileBackup(b.savedAt);
                              setBackupsOpen(false);
                              Alert.alert('Restored', 'Your profile was restored.');
                            } catch (error) {
                              Alert.alert('Could not restore', String(error));
                            }
                          },
                        },
                      ])
                    }
                  />
                </React.Fragment>
              ))}
            </ListCard>
          )}
        </View>
      </DetailPage>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  note: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
    marginBottom: 8,
  },
  aboutBlock: {
    paddingVertical: 14,
  },
  aboutText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  aboutSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  pagePadding: {
    paddingHorizontal: 20,
  },
  spacing: {
    height: 100,
  },
});
