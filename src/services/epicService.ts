// Service to fetch patient data from Epic FHIR backend
// Epic Sandbox: https://fhir.epic.com/interconnect-fhir-oauth

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { MedicalRecord } from '../types/medical';

// Configuration for Epic FHIR Sandbox
const FHIR_SERVER_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';
const OAUTH_AUTHORIZE_URL = `${BACKEND_URL}/api/auth/epic/authorize`;

// For Epic Sandbox testing, use this public test patient
const DEFAULT_TEST_PATIENT_ID = 'erXuFYUfucBZaryVksYEcMg3';

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  date: string;
  status: 'active' | 'inactive';
}

export interface Appointment {
  id: string;
  description: string;
  provider: string;
  date: string;
  time: string;
}

export interface Observation {
  id: string;
  code: string;
  value: string;
  unit: string;
  date: string;
}

export interface Allergy {
  id: string;
  allergen: string;
  reaction: string;
}

export interface Condition {
  id: string;
  name: string;
  onsetDate: string;
  status: string;
}

class EpicService {
  private patientId = DEFAULT_TEST_PATIENT_ID; // Default Epic sandbox test patient
  private accessToken: string | null = null;

  async initializeFromStorage(): Promise<void> {
    try {
      const token = await AsyncStorage.getItem('epic_access_token');
      if (token) {
        this.accessToken = token;
        console.log('✅ Loaded Epic access token from storage');
      }
    } catch (error) {
      console.error('Error loading Epic token:', error);
    }
  }


  setPatientId(id: string) {
    this.patientId = id;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private getAuthHeaders() {
    const headers: HeadersInit = {
      'Content-Type': 'application/fhir+json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async getPatient(): Promise<Patient> {
    try {
      const response = await fetch(`${FHIR_SERVER_URL}/Patient/${this.patientId}`, {
        headers: this.getAuthHeaders(),
      });
      const data = await response.json();

      return {
        id: data.id,
        name: data.name?.[0]?.given?.[0] + ' ' + data.name?.[0]?.family || 'Unknown',
        birthDate: data.birthDate || '',
        gender: data.gender || '',
      };
    } catch (error) {
      console.error('Error fetching patient:', error);
      throw error;
    }
  }

  async getMedications(): Promise<Medication[]> {
    try {
      const response = await fetch(
        `${FHIR_SERVER_URL}/MedicationRequest?patient=${this.patientId}&status=active`,
        { headers: this.getAuthHeaders() }
      );
      const data = await response.json();

      return data.entry?.map((entry: any) => ({
        id: entry.resource.id,
        name: entry.resource.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown',
        dosage: entry.resource.dosageInstruction?.[0]?.text || 'No dosage info',
        date: entry.resource.authoredOn || '',
        status: entry.resource.status || 'active',
      })) || [];
    } catch (error) {
      console.error('Error fetching medications:', error);
      throw error;
    }
  }

  async getAppointments(): Promise<Appointment[]> {
    try {
      const response = await fetch(
        `${FHIR_SERVER_URL}/Appointment?patient=${this.patientId}`,
        { headers: this.getAuthHeaders() }
      );
      const data = await response.json();

      return data.entry?.map((entry: any) => {
        const startDate = new Date(entry.resource.start);
        return {
          id: entry.resource.id,
          description: entry.resource.description || 'Appointment',
          provider: entry.resource.participant?.[0]?.actor?.display || 'Unknown Provider',
          date: startDate.toLocaleDateString(),
          time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      }) || [];
    } catch (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }
  }

  async getObservations(): Promise<Observation[]> {
    try {
      const response = await fetch(
        `${FHIR_SERVER_URL}/Observation?patient=${this.patientId}`,
        { headers: this.getAuthHeaders() }
      );
      const data = await response.json();

      return data.entry?.map((entry: any) => {
        const resource = entry.resource;
        let value = '';
        let unit = '';

        if (resource.valueQuantity) {
          value = resource.valueQuantity.value;
          unit = resource.valueQuantity.unit || '';
        } else if (resource.component) {
          value = resource.component.map((c: any) => `${c.code?.coding?.[0]?.display}: ${c.valueQuantity?.value} ${c.valueQuantity?.unit}`).join(', ');
        }

        return {
          id: resource.id,
          code: resource.code?.coding?.[0]?.display || 'Unknown',
          value: String(value),
          unit,
          date: resource.effectiveDateTime || '',
        };
      }) || [];
    } catch (error) {
      console.error('Error fetching observations:', error);
      throw error;
    }
  }

  async getAllergies(): Promise<Allergy[]> {
    try {
      const response = await fetch(
        `${FHIR_SERVER_URL}/AllergyIntolerance?patient=${this.patientId}`,
        { headers: this.getAuthHeaders() }
      );
      const data = await response.json();

      return data.entry?.map((entry: any) => ({
        id: entry.resource.id,
        allergen: entry.resource.code?.coding?.[0]?.display || 'Unknown',
        reaction: entry.resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || 'Unknown',
      })) || [];
    } catch (error) {
      console.error('Error fetching allergies:', error);
      throw error;
    }
  }

  async getConditions(): Promise<Condition[]> {
    try {
      const response = await fetch(
        `${FHIR_SERVER_URL}/Condition?patient=${this.patientId}`,
        { headers: this.getAuthHeaders() }
      );
      const data = await response.json();

      return data.entry?.map((entry: any) => ({
        id: entry.resource.id,
        name: entry.resource.code?.coding?.[0]?.display || 'Unknown',
        onsetDate: entry.resource.onsetDateTime || '',
        status: entry.resource.status || 'unknown',
      })) || [];
    } catch (error) {
      console.error('Error fetching conditions:', error);
      throw error;
    }
  }


  // Clear access token and connected status
  async fetchAllPatientData(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not connected to Epic. Please authenticate first.');
    }

    try {
      console.log('📥 Fetching patient data from backend...');

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';
      const response = await fetch(`${backendUrl}/api/auth/epic/patient-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: this.accessToken }),
      });

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();

      console.log(`✅ Fetched Epic data from backend:
        - Patient: ${data.patient?.name?.[0]?.given?.[0]}
        - Medications: ${data.medications?.length || 0}
        - Observations: ${data.observations?.length || 0}
        - Procedures: ${data.procedures?.length || 0}
        - Diagnostics: ${data.diagnostics?.length || 0}`);

      return {
        patient: data.patient,
        medications: data.medications || [],
        appointments: [],
        observations: data.observations || [],
        allergies: [],
        conditions: [],
        procedures: data.procedures || [],
        diagnostics: data.diagnostics || [],
      };
    } catch (error) {
      console.error('❌ Error fetching Epic data:', error);
      throw error;
    }
  }

  async convertEpicDataToMedicalRecords(epicData: any): Promise<any[]> {
    const records: any[] = [];
    const generateId = () => Math.random().toString(36).substring(2, 11);

    // Convert appointments to medical records
    if (epicData.appointments && epicData.appointments.length > 0) {
      epicData.appointments.forEach((apt: Appointment) => {
        records.push({
          id: generateId(),
          uploadDate: apt.date,
          appointmentDate: apt.date,
          specialty: 'Epic EHR',
          provider: apt.provider,
          summary: apt.description,
          reasonForVisit: apt.description,
          findings: 'Appointment from Epic EHR',
          nextSteps: '',
          notes: 'Imported from Epic',
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults: {},
            dates: { 'Appointment Date': apt.date },
          },
          processed: true,
          source: 'epic',
        });
      });
    }

    // Convert observations (lab results) to medical records
    if (epicData.observations && epicData.observations.length > 0) {
      const obsGroupedByDate: { [key: string]: any[] } = {};

      // Group observations by date
      epicData.observations.forEach((obs: Observation) => {
        if (!obsGroupedByDate[obs.date]) {
          obsGroupedByDate[obs.date] = [];
        }
        obsGroupedByDate[obs.date].push(obs);
      });

      // Convert each date's observations to a record
      Object.entries(obsGroupedByDate).forEach(([date, obsList]) => {
        const testResults: { [key: string]: string } = {};
        obsList.forEach((obs: Observation) => {
          testResults[obs.code] = `${obs.value} ${obs.unit}`;
        });

        records.push({
          id: generateId(),
          uploadDate: date,
          appointmentDate: date,
          specialty: 'Lab',
          provider: 'Epic EHR - Lab Results',
          summary: `Lab Results from ${new Date(date).toLocaleDateString()}`,
          reasonForVisit: 'Lab Work',
          findings: `${obsList.length} lab values`,
          nextSteps: 'Review with provider',
          notes: 'Imported from Epic',
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults,
            dates: { 'Test Date': date },
          },
          processed: true,
          source: 'epic',
        });
      });
    }

    // Add conditions as records
    if (epicData.conditions && epicData.conditions.length > 0) {
      epicData.conditions.forEach((cond: Condition) => {
        records.push({
          id: generateId(),
          uploadDate: cond.onsetDate || new Date().toISOString(),
          appointmentDate: cond.onsetDate || new Date().toISOString(),
          specialty: 'Primary Care',
          provider: 'Epic EHR - Conditions',
          summary: cond.name,
          reasonForVisit: cond.name,
          findings: `Status: ${cond.status}`,
          nextSteps: '',
          notes: 'Imported from Epic',
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [cond.name],
            testResults: {},
            dates: { 'Onset Date': cond.onsetDate || '' },
          },
          processed: true,
          source: 'epic',
        });
      });
    }

    // Convert procedures to medical records
    if (epicData.procedures && epicData.procedures.length > 0) {
      epicData.procedures.forEach((proc: any) => {
        const performedDate = proc.performedDateTime || proc.performedDate || new Date().toISOString();
        records.push({
          id: generateId(),
          uploadDate: performedDate,
          appointmentDate: performedDate,
          specialty: 'Surgical',
          provider: 'Epic EHR - Procedures',
          summary: proc.code?.coding?.[0]?.display || proc.code?.text || 'Procedure',
          reasonForVisit: proc.code?.coding?.[0]?.display || 'Medical Procedure',
          findings: `Status: ${proc.status}`,
          nextSteps: '',
          notes: proc.note?.[0]?.text || 'Imported from Epic',
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults: {},
            dates: { 'Procedure Date': performedDate },
          },
          processed: true,
          source: 'epic',
        });
      });
    }

    // Convert diagnostic reports to medical records
    if (epicData.diagnostics && epicData.diagnostics.length > 0) {
      epicData.diagnostics.forEach((diag: any) => {
        const issuedDate = diag.issued || new Date().toISOString();
        const testResults: { [key: string]: string } = {};

        // Extract results from contained resources if available
        if (diag.result) {
          diag.result.forEach((resultRef: any) => {
            testResults[resultRef.display || 'Result'] = resultRef.reference || '';
          });
        }

        records.push({
          id: generateId(),
          uploadDate: issuedDate,
          appointmentDate: issuedDate,
          specialty: 'Lab',
          provider: 'Epic EHR - Diagnostic Report',
          summary: `${diag.code?.coding?.[0]?.display || 'Diagnostic Report'} - ${diag.status}`,
          reasonForVisit: 'Diagnostic Testing',
          findings: `Status: ${diag.status}`,
          nextSteps: '',
          notes: diag.conclusion || 'Imported from Epic',
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults,
            dates: { 'Report Date': issuedDate },
          },
          processed: true,
          source: 'epic',
        });
      });
    }

    console.log(`✅ Converted ${records.length} records from Epic data`);
    return records;
  }

  async generateAuthorizationUrl(): Promise<{ url: string; state: string }> {
    try {
      console.log('🔐 Requesting authorization URL from backend...');

      // Call backend to get authorization URL and state
      const response = await fetch(`${BACKEND_URL}/api/auth/epic/authorize`);

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();
      const { url: authUrl, state } = data;

      // Save state for later verification
      await AsyncStorage.setItem('oauth_state', state);

      console.log('✅ Got authorization URL with state:', state);
      console.log('Authorization URL:', authUrl);

      return { url: authUrl, state };
    } catch (error) {
      console.error('Error generating authorization URL:', error);
      throw error;
    }
  }

  async retrieveTokenByState(state: string): Promise<string | null> {
    try {
      console.log('🔍 Retrieving token for state:', state);

      const response = await fetch(`${BACKEND_URL}/api/auth/epic/token/${state}`);

      if (!response.ok) {
        console.error('Token retrieval failed with status:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('✅ Token retrieved from backend');

      return data.access_token;
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  async handleOAuthCallback(token: string): Promise<void> {
    try {
      // Store the token
      await AsyncStorage.setItem('epic_access_token', token);
      await AsyncStorage.setItem('epic_connected', 'true');

      // Set the token in this service
      this.accessToken = token;

      console.log('✅ Epic OAuth token saved successfully');
    } catch (error) {
      console.error('Error saving token:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await AsyncStorage.removeItem('epic_access_token');
      await AsyncStorage.removeItem('epic_connected');
      await AsyncStorage.removeItem('oauth_state');
      this.accessToken = null;
      console.log('✅ Disconnected from Epic');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  }

  // Check if Epic is connected
  async isConnected(): Promise<boolean> {
    try {
      const connected = await AsyncStorage.getItem('epic_connected');
      const hasToken = await AsyncStorage.getItem('epic_access_token');
      return connected === 'true' && !!hasToken;
    } catch (error) {
      console.error('Error checking connection:', error);
      return false;
    }
  }

  // Initialize service with stored access token
  async initializeWithStoredToken(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem('epic_access_token');
      if (token) {
        this.setAccessToken(token);

        // Also load the saved patient ID if available
        const patientId = await AsyncStorage.getItem('epic_patient_id');
        if (patientId) {
          this.setPatientId(patientId);
          console.log('✅ Loaded patient ID:', patientId);
        }

        console.log('✅ Loaded Epic access token from storage');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing with stored token:', error);
      return false;
    }
  }

  // Get stored access token from AsyncStorage
  async getStoredAccessToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem('epic_access_token');
      return token;
    } catch (error) {
      console.error('Error retrieving stored access token:', error);
      return null;
    }
  }

  // Helper to generate random string for state parameter
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const epicService = new EpicService();
