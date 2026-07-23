import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { healthService } from '@/services/healthService';

interface WearableData {
  heartRate?: number;
  bloodOxygen?: number;
  bodyTemperature?: number;
  respiratoryRate?: number;
  hrv?: number;
  vo2Max?: number;
  restingHeartRate?: number;
  lastUpdated?: string;
  connected: boolean;
}

export default function WearableVitals() {
  const [wearableData, setWearableData] = useState<WearableData>({
    connected: false,
  });
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    checkWearableConnection();
  }, []);

  const checkWearableConnection = async () => {
    try {
      setLoading(true);
      // TODO: Implement HealthKit (iOS) / Google Fit (Android) check
      // This would use react-native-health or expo-health plugin
      // For now, showing structure and mock implementation
    } catch (error) {
      console.error('Error checking wearable connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectWearable = async () => {
    try {
      setConnecting(true);

      // Check if health data is available on this device
      const available = await healthService.isHealthDataAvailable();
      if (!available) {
        Alert.alert(
          'Not Available',
          'Health data is not available on this device'
        );
        return;
      }

      // Request permissions
      const hasPermission = await healthService.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Denied',
          'Please enable health app permissions in Settings'
        );
        return;
      }

      // Fetch all health data
      const healthData = await healthService.getAllHealthData();

      setWearableData({
        heartRate: healthData.heartRate,
        bloodOxygen: healthData.bloodOxygen,
        bodyTemperature: healthData.bodyTemperature
          ? parseFloat(healthData.bodyTemperature.toString()).toFixed(1)
          : undefined,
        respiratoryRate: healthData.respiratoryRate,
        hrv: healthData.hrv,
        vo2Max: healthData.vo2Max,
        restingHeartRate: healthData.restingHeartRate,
        lastUpdated: new Date().toLocaleTimeString(),
        connected: true,
      });

      Alert.alert('Connected', 'Successfully connected to your wearable device');
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to wearable device');
      console.error('Error connecting wearable:', error);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWearable = () => {
    setWearableData({ connected: false });
    Alert.alert('Disconnected', 'Wearable device disconnected');
  };

  const refreshData = async () => {
    try {
      setLoading(true);

      // Fetch fresh data from HealthKit/Google Fit
      const healthData = await healthService.getAllHealthData();

      setWearableData(prev => ({
        ...prev,
        heartRate: healthData.heartRate,
        bloodOxygen: healthData.bloodOxygen,
        bodyTemperature: healthData.bodyTemperature
          ? parseFloat(healthData.bodyTemperature.toString()).toFixed(1)
          : prev.bodyTemperature,
        respiratoryRate: healthData.respiratoryRate,
        hrv: healthData.hrv,
        vo2Max: healthData.vo2Max,
        restingHeartRate: healthData.restingHeartRate,
        lastUpdated: new Date().toLocaleTimeString(),
      }));

      Alert.alert('Updated', 'Wearable data refreshed');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh data');
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (!wearableData.connected) {
    return (
      <View style={styles.container}>
        <View style={styles.disconnectedCard}>
          <Text style={styles.icon}>⌚</Text>
          <Text style={styles.title}>Connect Your Wearable</Text>
          <Text style={styles.description}>
            Sync health data from Apple Watch, Fitbit, Garmin, and other devices
          </Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={connectWearable}
            disabled={connecting}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.connectButtonText}>Connect Device</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.connectedHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.connectedTitle}>Wearable Connected</Text>
          <Text style={styles.lastUpdate}>
            Last updated: {wearableData.lastUpdated}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshData}
            disabled={loading}
          >
            <Text style={styles.refreshButtonText}>{loading ? '⟳' : '↻'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={disconnectWearable}>
            <Text style={styles.disconnectButton}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.vitalsGrid}>
        {wearableData.heartRate !== undefined && (
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>❤️</Text>
            <Text style={styles.vitalLabel}>Heart Rate</Text>
            <Text style={styles.vitalValue}>{wearableData.heartRate}</Text>
            <Text style={styles.vitalUnit}>bpm</Text>
          </View>
        )}

        {wearableData.bloodOxygen !== undefined && (
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>💨</Text>
            <Text style={styles.vitalLabel}>Blood Oxygen</Text>
            <Text style={styles.vitalValue}>{wearableData.bloodOxygen}</Text>
            <Text style={styles.vitalUnit}>%</Text>
          </View>
        )}

        {wearableData.bodyTemperature !== undefined && (
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>🌡️</Text>
            <Text style={styles.vitalLabel}>Body Temp</Text>
            <Text style={styles.vitalValue}>{wearableData.bodyTemperature}</Text>
            <Text style={styles.vitalUnit}>°C</Text>
          </View>
        )}

        {wearableData.respiratoryRate !== undefined && (
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>🫁</Text>
            <Text style={styles.vitalLabel}>Respiratory</Text>
            <Text style={styles.vitalValue}>{wearableData.respiratoryRate}</Text>
            <Text style={styles.vitalUnit}>breaths/min</Text>
          </View>
        )}

        {wearableData.restingHeartRate !== undefined && (
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>😴</Text>
            <Text style={styles.vitalLabel}>Resting HR</Text>
            <Text style={styles.vitalValue}>{wearableData.restingHeartRate}</Text>
            <Text style={styles.vitalUnit}>bpm</Text>
          </View>
        )}

        {wearableData.hrv !== undefined && (
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>📈</Text>
            <Text style={styles.vitalLabel}>HRV</Text>
            <Text style={styles.vitalValue}>{wearableData.hrv}</Text>
            <Text style={styles.vitalUnit}>ms</Text>
          </View>
        )}

        {wearableData.vo2Max !== undefined && (
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>⚡</Text>
            <Text style={styles.vitalLabel}>VO2 Max</Text>
            <Text style={styles.vitalValue}>{wearableData.vo2Max}</Text>
            <Text style={styles.vitalUnit}>ml/kg/min</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginVertical: 16,
  },
  disconnectedCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  connectButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  connectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  connectedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  refreshButtonText: {
    fontSize: 18,
    color: '#1e40af',
    fontWeight: '600',
  },
  disconnectButton: {
    color: '#E53E3E',
    fontSize: 14,
    fontWeight: '600',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vitalCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  vitalIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e40af',
  },
  vitalUnit: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
