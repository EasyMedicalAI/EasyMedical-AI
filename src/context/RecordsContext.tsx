import React, { createContext, useContext, useEffect, useState } from 'react';
import { MedicalRecord, MedicalHub, UserHealthData } from '../types/medical';
import { storageService } from '../services/storageService';

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
  getRecordsBySpecialty: (specialty: string) => MedicalRecord[];
  getUniqueSpecialties: () => string[];
  getAllMedications: () => string[];
  getAllAllergies: () => string[];
  getRecentResults: (days?: number) => MedicalRecord[];
  getAbnormalResults: () => MedicalRecord[];
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
    getRecordsBySpecialty,
    getUniqueSpecialties,
    getAllMedications,
    getAllAllergies,
    getRecentResults,
    getAbnormalResults,
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
