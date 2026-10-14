import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { MedicalRecord, MedicalHub, UserHealthData, LabMetric } from '../types/medical';
import { storageService } from '../services/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ehrService, isWeightObservation } from '../services/ehrService';
import { birthdayFromFhir, genderFromFhir } from '../services/patientProfile';

// Empty initial state - will be populated from storage or user input
const EMPTY_USER_DATA: UserHealthData = {
  bloodType: '',
  height: '',
  weight: '',
  birthday: '',
  gender: 'Other',
  conditions: [],
  allergies: [],
  medications: [],
  appointments: [],
  vitals: {
    bloodPressure: '',
    heartRate: 0,
    lastUpdated: new Date().toISOString(),
  },
  vaccines: [],
  emergencyContacts: [],
  insurance: {
    provider: '',
    memberId: '',
    groupNumber: '',
  },
  insurances: [],
  lastVisitDate: '',
  pharmacy: undefined,
  screenings: [],
  prescriptionMedications: [],
  otcMedications: [],
  surgicalHistory: [],
  familyHistory: [],
  pastConditions: [],
  hospitalizations: [],
};

// Copies of the profile kept before each save, so a bad save can be undone
export interface ProfileBackup {
  savedAt: string;
  profile: UserHealthData;
}
const BACKUPS_KEY = 'profile_backups';
const MAX_BACKUPS = 20;

const rememberBeforeSave = async (previous: UserHealthData) => {
  try {
    const raw = await AsyncStorage.getItem(BACKUPS_KEY);
    const list: ProfileBackup[] = raw ? JSON.parse(raw) : [];
    list.unshift({ savedAt: new Date().toISOString(), profile: previous });
    await AsyncStorage.setItem(BACKUPS_KEY, JSON.stringify(list.slice(0, MAX_BACKUPS)));
  } catch (error) {
    console.error('Could not back up the profile before saving:', error);
  }
};

interface RecordsContextType {
  records: MedicalRecord[];
  userData: UserHealthData;
  loading: boolean;
  addRecord: (record: MedicalRecord) => Promise<void>;
  updateRecord: (record: MedicalRecord) => Promise<void>;
  deleteRecord: (recordId: string) => Promise<void>;
  updateUserData: (data: UserHealthData) => Promise<void>;
  profileBackups: () => Promise<ProfileBackup[]>;
  restoreProfileBackup: (savedAt: string) => Promise<void>;
  patchUserData: (patch: Partial<UserHealthData>) => Promise<void>;
  refreshRecords: () => Promise<void>;
  clearAllData: () => Promise<void>;
  syncWithEHR: () => Promise<{ added: number; duplicates: number }>;
  getRecordsBySpecialty: (specialty: string) => MedicalRecord[];
  getUniqueSpecialties: () => string[];
  getAllMedications: () => string[];
  getAllAllergies: () => string[];
  getRecentResults: (days?: number) => MedicalRecord[];
  getAbnormalResults: () => MedicalRecord[];
  // Metric tracking methods
  getAllMetrics: () => LabMetric[];
  getUniqueMetricNames: () => string[];
  getMetricHistory: (metricName: string) => LabMetric[];
  getLatestMetrics: () => Map<string, LabMetric>;
  calculateTrend: (metricName: string) => 'up' | 'down' | 'stable' | 'insufficient';
}

const RecordsContext = createContext<RecordsContextType | undefined>(undefined);

export function RecordsProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [userData, setUserData] = useState<UserHealthData>(EMPTY_USER_DATA);
  const [loading, setLoading] = useState(true);
  // Always the latest saved profile. Saves build on this, so a stale copy can never overwrite newer data.
  const latestUserData = useRef<UserHealthData>(EMPTY_USER_DATA);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const hub = await storageService.getMedicalHub();
      setRecords(hub.records);
      if (hub.userData) {
        setUserData(hub.userData);
        latestUserData.current = hub.userData;
      }
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRecord = async (record: MedicalRecord) => {
    try {
      await storageService.saveRecord(record);
      setRecords(prev => [...prev, record]);
    } catch (error) {
      console.error('Error adding record:', error);
      throw error;
    }
  };

  const updateRecord = async (record: MedicalRecord) => {
    try {
      await storageService.saveRecord(record);
      setRecords(prev => prev.map(r => r.id === record.id ? record : r));
    } catch (error) {
      console.error('Error updating record:', error);
      throw error;
    }
  };

  const deleteRecord = async (recordId: string) => {
    try {
      await storageService.deleteRecord(recordId);
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  };

  const updateUserData = async (data: UserHealthData) => {
    try {
      await rememberBeforeSave(latestUserData.current);
      latestUserData.current = data;
      await storageService.saveUserData(data);
      setUserData(data);
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  };

  // Saves only the fields given, on top of the latest saved profile
  const patchUserData = async (patch: Partial<UserHealthData>) => {
    await rememberBeforeSave(latestUserData.current);
    const next = { ...latestUserData.current, ...patch };
    latestUserData.current = next;
    setUserData(next);
    await storageService.saveUserData(next);
  };

  const profileBackups = async (): Promise<ProfileBackup[]> => {
    const raw = await AsyncStorage.getItem(BACKUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  };

  // Restoring is itself a save, so the profile as it was just before the restore is backed up too
  const restoreProfileBackup = async (savedAt: string) => {
    const backup = (await profileBackups()).find((b) => b.savedAt === savedAt);
    if (!backup) throw new Error('That backup could not be found.');
    await updateUserData(backup.profile);
  };

  const refreshRecords = async () => {
    setLoading(true);
    await loadRecords();
  };

  const getRecordsBySpecialty = (specialty: string) => {
    return records.filter(r => r.specialty === specialty);
  };

  const getUniqueSpecialties = () => {
    const specialties = new Set(records.map(r => r.specialty));
    return Array.from(specialties).sort();
  };

  const getAllMedications = () => {
    const meds = new Set<string>();
    records.forEach(r => {
      r.extractedData.medications?.forEach(med => meds.add(med));
    });
    return Array.from(meds).sort();
  };

  const getAllAllergies = () => {
    const allergies = new Set<string>();
    records.forEach(r => {
      r.extractedData.allergies?.forEach(allergy => allergies.add(allergy));
    });
    return Array.from(allergies).sort();
  };

  const getRecentResults = (days = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return records.filter(r => {
      const uploadDate = new Date(r.uploadDate);
      return uploadDate >= cutoffDate;
    }).sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  };

  const getAbnormalResults = () => {
    return records.filter(r => {
      const summary = r.summary.toLowerCase();
      return summary.includes('abnormal') || summary.includes('high') || summary.includes('low') || summary.includes('critical');
    });
  };

  const getAllMetrics = (): LabMetric[] => {
    const allMetrics: LabMetric[] = [];
    records.forEach(r => {
      if (r.extractedData.labMetrics) {
        allMetrics.push(...r.extractedData.labMetrics);
      }
    });
    return allMetrics.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getUniqueMetricNames = (): string[] => {
    const names = new Set<string>();
    records.forEach(r => {
      if (r.extractedData.labMetrics) {
        r.extractedData.labMetrics.forEach(m => names.add(m.name));
      }
    });
    return Array.from(names).sort();
  };

  const getMetricHistory = (metricName: string): LabMetric[] => {
    const metrics = getAllMetrics().filter(m => m.name === metricName);
    return metrics.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const getLatestMetrics = (): Map<string, LabMetric> => {
    const latestMap = new Map<string, LabMetric>();
    const allMetrics = getAllMetrics();

    allMetrics.forEach(metric => {
      const existing = latestMap.get(metric.name);
      if (!existing || new Date(metric.date) > new Date(existing.date)) {
        latestMap.set(metric.name, metric);
      }
    });

    return latestMap;
  };

  const calculateTrend = (metricName: string): 'up' | 'down' | 'stable' | 'insufficient' => {
    const history = getMetricHistory(metricName);
    if (history.length < 2) return 'insufficient';

    // Get numeric values
    const numericValues = history
      .map(m => {
        if (typeof m.value === 'number') return m.value;
        const parsed = parseFloat(String(m.value));
        return isNaN(parsed) ? null : parsed;
      })
      .filter(v => v !== null) as number[];

    if (numericValues.length < 2) return 'insufficient';

    const oldest = numericValues[0];
    const newest = numericValues[numericValues.length - 1];
    const diff = newest - oldest;
    const changePercent = Math.abs(diff / oldest) * 100;

    // If change is less than 5%, consider it stable
    if (changePercent < 5) return 'stable';
    if (diff > 0) return 'up';
    if (diff < 0) return 'down';
    return 'stable';
  };

  const clearAllData = async () => {
    try {
      await storageService.clearAll();
      setRecords([]);
      setUserData({
        bloodType: '',
        height: '',
        weight: '',
        birthday: '',
        gender: '',
        conditions: [],
        allergies: [],
        medications: [],
        appointments: [],
        vitals: {
          bloodPressure: '',
          heartRate: 0,
          lastUpdated: new Date().toISOString(),
        },
        vaccines: [],
        emergencyContacts: [],
        insurance: {
          provider: '',
          memberId: '',
          groupNumber: '',
        },
        insurances: [],
        lastVisitDate: '',
        pharmacy: {
          name: '',
          address: '',
          phone: '',
        },
        screenings: [],
        prescriptionMedications: [],
        otcMedications: [],
        surgicalHistory: [],
        familyHistory: [],
        pastConditions: [],
        hospitalizations: [],
      });
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  };

  // Syncs every connected EHR system (Epic, Oracle Health, ...) into records. Dedupes against existing records.
  const syncWithEHR = async (): Promise<{ added: number; duplicates: number }> => {
    try {
      console.log('🔄 Syncing with connected EHR systems...');
      const sources = await ehrService.fetchAllPatientData();

      let added = 0;
      let duplicates = 0;

      for (const source of sources) {
        const ehrRecords = await ehrService.convertToMedicalRecords(source.data, source.label, source.systemId);

        for (const ehrRecord of ehrRecords) {
          // Check for duplicates based on date + provider + summary
          const isDuplicate = records.some(
            (r) =>
              new Date(r.appointmentDate || r.uploadDate).toDateString() ===
                new Date(ehrRecord.appointmentDate || ehrRecord.uploadDate).toDateString() &&
              r.provider === ehrRecord.provider &&
              r.summary === ehrRecord.summary
          );

          if (isDuplicate) {
            console.log(`⏭️ Skipping duplicate: ${ehrRecord.summary}`);
            duplicates++;
          } else {
            console.log(`➕ Adding: ${ehrRecord.summary}`);
            await addRecord(ehrRecord);
            added++;
          }
        }

        const data = source.data;
      }

      // Demographics from Epic fill in only blank fields. Anything already entered stays as it is.
      // "Other" is the default gender for a new profile, so Epic's value replaces it.
      const epicPatient = sources.map((s) => s.data?.patient).find(Boolean);
      const demographics: { birthday?: string; gender?: string } = {};
      if (epicPatient) {
        if (!userData.birthday) {
          const birthday = birthdayFromFhir(epicPatient.birthDate);
          if (birthday) demographics.birthday = birthday;
        }
        if (!userData.gender || userData.gender === 'Other') {
          const gender = genderFromFhir(epicPatient.gender);
          if (gender) demographics.gender = gender;
        }
      }
      const demographicsChanged = Object.keys(demographics).length > 0;

      // Weight and blood pressure from Epic join the same history the Home screen charts. Each reading is added once.
      const epicWeights: { date: string; value: number }[] = [];
      const epicBloodPressures: { date: string; systolic: number; diastolic: number }[] = [];
      for (const source of sources) {
        for (const o of source.data.observations || []) {
          if (o.systolic != null && o.diastolic != null) {
            epicBloodPressures.push({ date: o.date, systolic: o.systolic, diastolic: o.diastolic });
          } else if (isWeightObservation(o)) {
            const raw = Number(o.value);
            if (!isNaN(raw)) {
              const inPounds = /kg/i.test(o.unit || '') ? Math.round(raw * 2.20462 * 10) / 10 : raw;
              epicWeights.push({ date: o.date, value: inPounds });
            }
          }
        }
      }
      const addMissing = <T,>(existing: T[] = [], incoming: T[], same: (a: T, b: T) => boolean): T[] => {
        const merged = [...existing];
        incoming.forEach((item) => {
          if (!merged.some((m) => same(m, item))) merged.push(item);
        });
        return merged;
      };
      const weightHistory = addMissing(latestUserData.current.weightHistory, epicWeights,
        (a, b) => a.date === b.date && a.value === b.value);
      const bloodPressureHistory = addMissing(latestUserData.current.bloodPressureHistory, epicBloodPressures,
        (a, b) => a.date === b.date && a.systolic === b.systolic && a.diastolic === b.diastolic);
      const vitalsChanged =
        weightHistory.length !== (userData.weightHistory || []).length ||
        bloodPressureHistory.length !== (userData.bloodPressureHistory || []).length;

      // Merge demographics, medications, allergies and conditions from all systems into userData in one save
      if (demographicsChanged || vitalsChanged) {
        await patchUserData({
          ...demographics,
          weightHistory,
          bloodPressureHistory,
        });
        if (demographicsChanged) console.log('✅ Filled profile from Epic:', demographics);
      }

      console.log(`✅ EHR sync complete: ${added} added, ${duplicates} duplicates skipped`);
      return { added, duplicates };
    } catch (error) {
      console.error('❌ Error syncing with EHR:', error);
      throw error;
    }
  };

  const value: RecordsContextType = {
    records,
    userData,
    loading,
    addRecord,
    updateRecord,
    deleteRecord,
    updateUserData,
    patchUserData,
    profileBackups,
    restoreProfileBackup,
    refreshRecords,
    clearAllData,
    syncWithEHR,
    getRecordsBySpecialty,
    getUniqueSpecialties,
    getAllMedications,
    getAllAllergies,
    getRecentResults,
    getAbnormalResults,
    getAllMetrics,
    getUniqueMetricNames,
    getMetricHistory,
    getLatestMetrics,
    calculateTrend,
  };

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords() {
  const context = useContext(RecordsContext);
  if (context === undefined) {
    throw new Error('useRecords must be used within a RecordsProvider');
  }
  return context;
}
