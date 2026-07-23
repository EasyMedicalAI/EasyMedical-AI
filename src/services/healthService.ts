import { Platform } from 'react-native';

// Import react-native-health
let RNHealth: any;
try {
  RNHealth = require('react-native-health').default;
} catch (e) {
  console.warn('react-native-health not available');
}

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
   * Request permissions from HealthKit (iOS) or Google Fit (Android)
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios' && RNHealth) {
        const permissions = {
          permissions: {
            read: [
              'HKQuantityTypeIdentifierHeartRate',
              'HKQuantityTypeIdentifierOxygenSaturation',
              'HKQuantityTypeIdentifierBodyTemperature',
              'HKQuantityTypeIdentifierRespiratoryRate',
              'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
              'HKQuantityTypeIdentifierVO2Max',
              'HKQuantityTypeIdentifierRestingHeartRate',
            ],
          },
        };

        await RNHealth.initHealthKit(permissions);
        return true;
      } else if (Platform.OS === 'android') {
        console.log('Google Fit integration coming soon');
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting health permissions:', error);
      return false;
    }
  },

  /**
   * Fetch latest heart rate data
   */
  async getHeartRate(): Promise<number | undefined> {
    try {
      if (!RNHealth) return undefined;

      const startDate = new Date();
      startDate.setMinutes(startDate.getMinutes() - 5);

      const samples = await RNHealth.getHeartRateSamples({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      });

      return samples?.length > 0 ? Math.round(samples[0].value) : undefined;
    } catch (error) {
      console.error('Error fetching heart rate:', error);
      return undefined;
    }
  },

  /**
   * Fetch latest blood oxygen (SpO2) data
   */
  async getBloodOxygen(): Promise<number | undefined> {
    try {
      if (!RNHealth) return undefined;

      const startDate = new Date();
      startDate.setMinutes(startDate.getMinutes() - 5);

      const samples = await RNHealth.getOxygenSaturationSamples({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      });

      return samples?.length > 0 ? Math.round(samples[0].value) : undefined;
    } catch (error) {
      console.error('Error fetching blood oxygen:', error);
      return undefined;
    }
  },

  /**
   * Fetch latest body temperature data
   */
  async getBodyTemperature(): Promise<number | undefined> {
    try {
      if (!RNHealth) return undefined;

      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 1);

      const samples = await RNHealth.getBodyTemperatureSamples({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      });

      return samples?.length > 0 ? parseFloat(samples[0].value.toFixed(1)) : undefined;
    } catch (error) {
      console.error('Error fetching body temperature:', error);
      return undefined;
    }
  },

  /**
   * Fetch latest respiratory rate data
   */
  async getRespiratoryRate(): Promise<number | undefined> {
    try {
      if (!RNHealth) return undefined;

      const startDate = new Date();
      startDate.setMinutes(startDate.getMinutes() - 5);

      const samples = await RNHealth.getRespiratoryRateSamples({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      });

      return samples?.length > 0 ? Math.round(samples[0].value) : undefined;
    } catch (error) {
      console.error('Error fetching respiratory rate:', error);
      return undefined;
    }
  },

  /**
   * Fetch latest HRV (Heart Rate Variability) data
   */
  async getHRV(): Promise<number | undefined> {
    try {
      if (!RNHealth) return undefined;

      const startDate = new Date();
      startDate.setMinutes(startDate.getMinutes() - 5);

      const samples = await RNHealth.getHeartRateVariabilitySamples({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      });

      return samples?.length > 0 ? Math.round(samples[0].value) : undefined;
    } catch (error) {
      console.error('Error fetching HRV:', error);
      return undefined;
    }
  },

  /**
   * Fetch latest VO2 Max data
   */
  async getVO2Max(): Promise<number | undefined> {
    try {
      if (!RNHealth) return undefined;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const samples = await RNHealth.getVO2MaxSamples({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      });

      return samples?.length > 0 ? Math.round(samples[0].value) : undefined;
    } catch (error) {
      console.error('Error fetching VO2 Max:', error);
      return undefined;
    }
  },

  /**
   * Fetch latest resting heart rate data
   */
  async getRestingHeartRate(): Promise<number | undefined> {
    try {
      if (!RNHealth) return undefined;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);

      const samples = await RNHealth.getRestingHeartRateSamples({
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        limit: 1,
      });

      return samples?.length > 0 ? Math.round(samples[0].value) : undefined;
    } catch (error) {
      console.error('Error fetching resting heart rate:', error);
      return undefined;
    }
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
   * Check if HealthKit is available on this device
   */
  async isHealthDataAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios' && RNHealth) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking health data availability:', error);
      return false;
    }
  },
};
