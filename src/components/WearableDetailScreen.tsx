// Wearable details: connect Apple Health and see every metric it provides.
import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { healthStatus, requestAccess, readAllMetrics, MetricReading } from '@/services/healthService';

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export default function WearableDetailScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [status, setStatus] = useState(healthStatus());
  const [metrics, setMetrics] = useState<MetricReading[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) setStatus(healthStatus());
  }, [visible]);

  const connect = async () => {
    setLoading(true);
    try {
      const granted = await requestAccess();
      if (!granted) {
        Alert.alert('Not connected', 'Apple Health is not available in this version of the app yet, or access was not granted.');
        return;
      }
      setMetrics(await readAllMetrics());
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      setMetrics(await readAllMetrics());
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Wearable device</Text>
          <Text style={styles.subtitle}>Apple Health brings in data from Apple Watch and other connected devices.</Text>

          {!status.ready ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{status.message}</Text>
            </View>
          ) : metrics === null ? (
            <TouchableOpacity style={styles.button} onPress={connect} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Connect Apple Health</Text>}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.buttonSecondary} onPress={refresh} disabled={loading}>
                {loading ? <ActivityIndicator color="#007AFF" /> : <Text style={styles.buttonSecondaryText}>Refresh</Text>}
              </TouchableOpacity>

              <Text style={styles.sectionLabel}>All metrics</Text>
              {metrics.map((m) => (
                <View key={m.label} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metricName}>{m.label}</Text>
                    {m.date ? <Text style={styles.metricDate}>{formatDate(m.date)}</Text> : null}
                  </View>
                  <Text style={m.value ? styles.metricValue : styles.noData}>{m.value || 'No data yet'}</Text>
                </View>
              ))}
              <Text style={styles.note}>
                If a metric shows no data, check that EasyMedical is allowed to read it in the Health app (Sharing, then Apps).
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  close: {
    fontSize: 26,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  notice: {
    backgroundColor: '#FFF8DC',
    borderRadius: 10,
    padding: 14,
  },
  noticeText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonSecondaryText: {
    color: '#007AFF',
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  metricName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  metricDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
    marginLeft: 12,
  },
  noData: {
    fontSize: 13,
    color: '#999',
    marginLeft: 12,
  },
  note: {
    fontSize: 12,
    color: '#888',
    marginTop: 16,
    lineHeight: 18,
  },
});
