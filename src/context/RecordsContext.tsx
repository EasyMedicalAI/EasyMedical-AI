import React, { createContext, useContext, useEffect, useState } from 'react';
import { MedicalRecord, MedicalHub, UserHealthData, LabMetric } from '../types/medical';
import { storageService } from '../services/storageService';
import { epicService } from '../services/epicService';

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

interface RecordsContextType {
  records: MedicalRecord[];
  userData: UserHealthData;
  loading: boolean;
  addRecord: (record: MedicalRecord) => Promise<void>;
  updateRecord: (record: MedicalRecord) => Promise<void>;
  deleteRecord: (recordId: string) => Promise<void>;
  updateUserData: (data: UserHealthData) => Promise<void>;
  refreshRecords: () => Promise<void>;
  clearAllData: () => Promise<void>;
  syncWithEpic: () => Promise<{ added: number; duplicates: number }>;
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

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const hub = await storageService.getMedicalHub();
      setRecords(hub.records);
      if (hub.userData) {
        setUserData(hub.userData);
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
      await storageService.saveUserData(data);
      setUserData(data);
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
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

  const syncWithEpic = async (): Promise<{ added: number; duplicates: number }> => {
    try {
      console.log('🔄 Syncing with Epic...');
      const token = await epicService.getStoredAccessToken();
      console.log('Access token:', token ? 'Present' : 'Missing');

      // Fetch all data from Epic
      console.log('📥 About to fetch all patient data...');
      const epicData = await epicService.fetchAllPatientData();
      console.log('📊 Epic data received:', epicData);

      // Show debug info
      if (!epicData || Object.keys(epicData).length === 0) {
        console.error('❌ No Epic data returned!');
      }

      // Convert Epic data to MedicalRecords
      const epicRecords = await epicService.convertEpicDataToMedicalRecords(epicData);

      console.log(`📊 Got ${epicRecords.length} records from Epic`);
      if (epicRecords.length > 0) {
        console.log('🔍 First Epic record:', JSON.stringify(epicRecords[0], null, 2));
      }

      // Merge with existing records (no deletion)
      let added = 0;
      let duplicates = 0;

      for (const epicRecord of epicRecords) {
        // Check for duplicates based on date + provider + summary
        const isDuplicate = records.some(
          (r) =>
            new Date(r.appointmentDate || r.uploadDate).toDateString() ===
              new Date(epicRecord.appointmentDate || epicRecord.uploadDate).toDateString() &&
            r.provider === epicRecord.provider &&
            r.summary === epicRecord.summary
        );

        if (isDuplicate) {
          console.log(`⏭️ Skipping duplicate: ${epicRecord.summary}`);
          duplicates++;
        } else {
          console.log(`➕ Adding: ${epicRecord.summary}`);
          await addRecord(epicRecord);
          added++;
        }
      }

      // Merge medications, conditions, and allergies into userData
      let hasHealthDataChanges = false;
      let mergedUserData = { ...userData };

      if (epicData.medications && epicData.medications.length > 0) {
        const medNames = epicData.medications.map((m: any) => m.name || m.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown');
        console.log(`💊 Found ${medNames.length} medications from Epic`);
        mergedUserData.medications = Array.from(new Set([...mergedUserData.medications, ...medNames]));
        mergedUserData.prescriptionMedications = Array.from(new Set([...mergedUserData.prescriptionMedications, ...medNames]));
        hasHealthDataChanges = true;
      }

      if (epicData.allergies && epicData.allergies.length > 0) {
        const allergyNames = epicData.allergies.map((a: any) => a.allergen || a.code?.coding?.[0]?.display || 'Unknown');
        console.log(`⚠️ Found ${allergyNames.length} allergies from Epic`);
        mergedUserData.allergies = Array.from(new Set([...mergedUserData.allergies, ...allergyNames]));
        hasHealthDataChanges = true;
      }

      if (epicData.conditions && epicData.conditions.length > 0) {
        const conditionNames = epicData.conditions.map((c: any) => c.name || c.code?.coding?.[0]?.display || 'Unknown');
        console.log(`🏥 Found ${conditionNames.length} conditions from Epic`);
        mergedUserData.conditions = Array.from(new Set([...mergedUserData.conditions, ...conditionNames]));
        hasHealthDataChanges = true;
      }

      // Save merged health data all at once
      if (hasHealthDataChanges) {
        console.log('📝 Updating user health data with Epic info...');
        await updateUserData(mergedUserData);
      }

      console.log(`✅ Epic sync complete: ${added} added, ${duplicates} duplicates skipped`);
      return { added, duplicates };
    } catch (error) {
      console.error('❌ Error syncing with Epic:', error);
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
    refreshRecords,
    clearAllData,
    syncWithEpic,
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
