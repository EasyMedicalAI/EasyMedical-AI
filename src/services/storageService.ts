import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicalHub, MedicalRecord, UserHealthData } from '../types/medical';

const STORAGE_KEY = '@easy_medical_hub';

export const storageService = {
  async getMedicalHub(): Promise<MedicalHub> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : { records: [], userData: {} };
    } catch (error) {
      console.error('Error reading medical hub:', error);
      return { records: [], userData: {} };
    }
  },

  async saveUserData(userData: UserHealthData): Promise<void> {
    try {
      const hub = await this.getMedicalHub();
      hub.userData = userData;
      hub.lastSyncDate = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hub));
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  },

  async saveRecord(record: MedicalRecord): Promise<void> {
    try {
      const hub = await this.getMedicalHub();
      const existingIndex = hub.records.findIndex(r => r.id === record.id);

      if (existingIndex >= 0) {
        hub.records[existingIndex] = record;
      } else {
        hub.records.push(record);
      }

      hub.lastSyncDate = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hub));
    } catch (error) {
      console.error('Error saving record:', error);
      throw error;
    }
  },

  async deleteRecord(recordId: string): Promise<void> {
    try {
      const hub = await this.getMedicalHub();
      hub.records = hub.records.filter(r => r.id !== recordId);
      hub.lastSyncDate = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hub));
    } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  },

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },
};
