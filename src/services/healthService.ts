// Apple Health (HealthKit) reads. Nothing here generates made-up numbers: a metric with no data shows as "no data yet".
import { Platform } from 'react-native';

export interface HealthMetric {
  id: string;
  label: string;
  // "latest" shows the most recent reading; "today" adds up everything recorded since midnight
  kind: 'latest' | 'today';
}

export const HEALTH_METRICS: HealthMetric[] = [
  { id: 'HKQuantityTypeIdentifierHeartRate', label: 'Heart rate', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierRestingHeartRate', label: 'Resting heart rate', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', label: 'Heart rate variability', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierOxygenSaturation', label: 'Blood oxygen', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierRespiratoryRate', label: 'Respiratory rate', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierBodyTemperature', label: 'Body temperature', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierVO2Max', label: 'VO2 max', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierBodyMass', label: 'Body weight', kind: 'latest' },
  { id: 'HKQuantityTypeIdentifierStepCount', label: 'Steps', kind: 'today' },
  { id: 'HKQuantityTypeIdentifierActiveEnergyBurned', label: 'Active energy', kind: 'today' },
  { id: 'HKQuantityTypeIdentifierDistanceWalkingRunning', label: 'Walking and running distance', kind: 'today' },
];

// The HealthKit module is loaded only if this build includes it, so the rest of the app still runs without it
let healthKitModule: any | null | undefined;
const healthKit = (): any | null => {
  if (healthKitModule !== undefined) return healthKitModule;
  try {
    healthKitModule = require('@kingstinct/react-native-healthkit');
  } catch {
    healthKitModule = null;
  }
  return healthKitModule;
};

export type HealthStatus = { ready: boolean; message?: string };

export const healthStatus = (): HealthStatus => {
  if (Platform.OS !== 'ios') return { ready: false, message: 'Apple Health is only available on iPhone.' };
  const hk = healthKit();
  if (!hk) return { ready: false, message: 'Apple Health is not set up in this version of the app yet.' };
  try {
    return hk.isHealthDataAvailable()
      ? { ready: true }
      : { ready: false, message: 'Health data is not available on this device.' };
  } catch {
    return { ready: false, message: 'Apple Health could not be reached.' };
  }
};

// Opens the iPhone permission sheet. Returns false if Apple Health can't be reached.
export const requestAccess = async (): Promise<boolean> => {
  const hk = healthKit();
  if (!hk) return false;
  return hk.requestAuthorization({ toRead: HEALTH_METRICS.map((m) => m.id) });
};

export interface MetricReading {
  label: string;
  value?: string;
  date?: string; // when the latest reading was taken, or the day for totals
}

const round = (n: number) => Math.round(n * 10) / 10;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Reads every metric. Denied or missing data shows as "no data yet" (iPhone doesn't say which).
export const readAllMetrics = async (): Promise<MetricReading[]> => {
  const hk = healthKit();
  if (!hk) return HEALTH_METRICS.map((m) => ({ label: m.label }));

  return Promise.all(
    HEALTH_METRICS.map(async (metric): Promise<MetricReading> => {
      try {
        if (metric.kind === 'latest') {
          const samples = await hk.queryQuantitySamples(metric.id, { limit: 1 });
          const sample = samples[0];
          if (!sample) return { label: metric.label };
          return {
            label: metric.label,
            value: `${round(sample.quantity)} ${sample.unit}`,
            date: new Date(sample.endDate).toISOString(),
          };
        }

        const now = new Date();
        const samples = await hk.queryQuantitySamples(metric.id, {
          limit: -1,
          filter: { date: { startDate: startOfToday(), endDate: now } },
        });
        if (!samples.length) return { label: metric.label };
        const total = samples.reduce((sum: number, s: any) => sum + s.quantity, 0);
        return {
          label: metric.label,
          value: `${round(total)} ${samples[0].unit}`,
          date: now.toISOString(),
        };
      } catch {
        return { label: metric.label };
      }
    })
  );
};
