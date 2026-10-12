import React, { createContext, useContext, useEffect, useState } from 'react';
import { MedicalRecord, MedicalHub, UserHealthData, LabMetric } from '../types/medical';
import { storageService } from '../services/storageService';
import { ehrService } from '../services/ehrService';

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

  // Syncs every connected EHR system (Epic, Oracle Health, ...) into records. Dedupes against existing records.
  const syncWithEHR = async (): Promise<{ added: number; duplicates: number }> => {
    try {
      console.log('🔄 Syncing with connected EHR systems...');
      const sources = await ehrService.fetchAllPatientData();

      let added = 0;
      let duplicates = 0;
      const medNames: string[] = [];
      const allergyNames: string[] = [];
      const conditionNames: string[] = [];

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
        (data.medications || []).forEach((m: any) =>
          medNames.push(m.name || m.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown'));
        (data.allergies || []).forEach((a: any) =>
          allergyNames.push(a.allergen || a.code?.coding?.[0]?.display || 'Unknown'));
        (data.conditions || []).forEach((c: any) =>
          conditionNames.push(c.name || c.code?.coding?.[0]?.display || 'Unknown'));
      }

      // Merge medications, allergies and conditions from all systems into userData in one save
      if (medNames.length || allergyNames.length || conditionNames.length) {
        await updateUserData({
          ...userData,
          medications: Array.from(new Set([...userData.medications, ...medNames])),
          prescriptionMedications: Array.from(new Set([...userData.prescriptionMedications, ...medNames])),
          allergies: Array.from(new Set([...userData.allergies, ...allergyNames])),
          conditions: Array.from(new Set([...userData.conditions, ...conditionNames])),
        });
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
