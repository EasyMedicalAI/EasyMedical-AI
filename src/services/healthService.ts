import { Platform } from 'react-native';

// Mock data generator for wearable health metrics
// This provides realistic simulated data for development/testing
// Real HealthKit integration can replace these methods later without changing the component interface

// Types for health data
export interface HealthData {
  heartRate?: number;
  bloodOxygen?: number;
  bodyTemperature?: number;
  respiratoryRate?: number;
  hrv?: number;
  vo2Max?: number;
  restingHeartRate?: number;
  timestamp?: Date;
}

export const healthService = {
  /**
   * Request permissions (mock - always succeeds)
   * Real HealthKit permissions will be handled when react-native-health is integrated
   */
  async requestPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 500);
    });
  },

  /**
   * Fetch latest heart rate data (mock)
   * Returns realistic heart rate between 60-100 bpm with natural variation
   */
  async getHeartRate(): Promise<number | undefined> {
    const baseHR = 72;
    const variance = Math.sin(Date.now() / 5000) * 8;
    const noise = (Math.random() - 0.5) * 6;
    return Math.round(baseHR + variance + noise);
  },

  /**
   * Fetch latest blood oxygen (SpO2) data (mock)
   * Returns realistic SpO2 between 95-99%
   */
  async getBloodOxygen(): Promise<number | undefined> {
    return 96 + Math.random() * 3;
  },

  /**
   * Fetch latest body temperature data (mock)
   * Returns realistic body temperature between 36.5-37.5°C
   */
  async getBodyTemperature(): Promise<number | undefined> {
    return parseFloat((36.8 + (Math.random() - 0.5) * 0.6).toFixed(1));
  },

  /**
   * Fetch latest respiratory rate data (mock)
   * Returns realistic respiratory rate between 12-20 breaths/min
   */
  async getRespiratoryRate(): Promise<number | undefined> {
    return Math.round(16 + (Math.random() - 0.5) * 6);
  },

  /**
   * Fetch latest HRV (Heart Rate Variability) data (mock)
   * Returns realistic HRV between 20-80ms
   */
  async getHRV(): Promise<number | undefined> {
    return Math.round(50 + (Math.random() - 0.5) * 40);
  },

  /**
   * Fetch latest VO2 Max data (mock)
   * Returns realistic VO2 Max between 30-50 ml/kg/min
   */
  async getVO2Max(): Promise<number | undefined> {
    return Math.round(42 + (Math.random() - 0.5) * 12);
  },

  /**
   * Fetch latest resting heart rate data (mock)
   * Returns realistic resting heart rate between 50-70 bpm
   */
  async getRestingHeartRate(): Promise<number | undefined> {
    return Math.round(58 + (Math.random() - 0.5) * 12);
  },

  /**
   * Fetch all health data at once
   */
  async getAllHealthData(): Promise<HealthData> {
    try {
      const [
        heartRate,
        bloodOxygen,
        bodyTemperature,
        respiratoryRate,
        hrv,
        vo2Max,
        restingHeartRate,
      ] = await Promise.all([
        this.getHeartRate(),
        this.getBloodOxygen(),
        this.getBodyTemperature(),
        this.getRespiratoryRate(),
        this.getHRV(),
        this.getVO2Max(),
        this.getRestingHeartRate(),
      ]);

      return {
        heartRate,
        bloodOxygen,
        bodyTemperature,
        respiratoryRate,
        hrv,
        vo2Max,
        restingHeartRate,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error fetching all health data:', error);
      return { timestamp: new Date() };
    }
  },

  /**
   * Check if HealthKit is available (mock - always true for development)
   */
  async isHealthDataAvailable(): Promise<boolean> {
    return Platform.OS === 'ios';
  },
};
