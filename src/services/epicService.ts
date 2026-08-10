// Service to fetch patient data from Epic FHIR backend
// Epic Sandbox: https://fhir.epic.com/interconnect-fhir-oauth

import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // OAuth SMART on FHIR Flow Methods

  // Generate authorization URL - backend handles OAuth flow
  async generateAuthorizationUrl(): Promise<{ url: string; state: string }> {
    // Get the authorization URL and state from the backend
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/epic/authorize`, {
        method: 'GET',
        redirect: 'manual', // Don't follow redirects
      });

      // Extract state from Location header (the 302 redirect URL)
      const locationHeader = response.headers.get('location');
      if (!locationHeader) {
        throw new Error('No redirect location from authorization endpoint');
      }

      // Extract state from the URL
      const url = new URL(locationHeader);
      const state = url.searchParams.get('state');
      if (!state) {
        throw new Error('No state in authorization URL');
      }

      return {
        url: locationHeader,
        state: state,
      };
    } catch (error) {
      console.error('Error generating authorization URL:', error);
      throw error;
    }
  }

  // Retrieve token after authorization using state
  async retrieveTokenByState(state: string): Promise<string | null> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/epic/token/${state}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('Token not found for state:', state);
          return null;
        }
        throw new Error(`Failed to retrieve token: ${response.status}`);
      }

      const tokenData = await response.json();
      return tokenData.access_token;
    } catch (error) {
      console.error('Error retrieving token by state:', error);
      return null;
    }
  }


  // Handle OAuth callback from backend
  async handleOAuthCallback(token: string): Promise<void> {
    try {
      // Save token and set in service
      await this.saveAccessToken(token);
      this.setAccessToken(token);

      // Extract patient ID from the JWT token (fhirUser claim)
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          // Decode the payload (second part)
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf8')
          );

          // Look for fhirUser claim which contains the patient reference
          if (payload.fhirUser) {
            // fhirUser is in format "Patient/123456"
            const patientId = payload.fhirUser.split('/').pop();
            if (patientId) {
              console.log('✅ Got patient ID from token:', patientId);
              this.setPatientId(patientId);
              await AsyncStorage.setItem('epic_patient_id', patientId);
            }
          } else {
            console.warn('No fhirUser in token, using default test patient');
          }
        }
      } catch (err) {
        console.warn('Error decoding token:', err, '- using default test patient');
      }

      // Save connected status
      await AsyncStorage.setItem('epic_connected', 'true');
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      throw error;
    }
  }

  // Initialize service with stored access token
  async initializeWithStoredToken(): Promise<boolean> {
    try {
      const token = await this.getStoredAccessToken();
      if (token) {
        this.setAccessToken(token);

        // Also load the saved patient ID
        const patientId = await AsyncStorage.getItem('epic_patient_id');
        if (patientId) {
          this.setPatientId(patientId);
          console.log('✅ Loaded patient ID:', patientId);
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error('Error initializing with stored token:', error);
      return false;
    }
  }

  // Check if Epic is connected
  async isConnected(): Promise<boolean> {
    try {
      const connected = await AsyncStorage.getItem('epic_connected');
      const hasToken = await this.getStoredAccessToken();
      return connected === 'true' && !!hasToken;
    } catch (error) {
      console.error('Error checking connection:', error);
      return false;
    }
  }

  // Save access token
  private async saveAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem('epic_access_token', token);
    } catch (error) {
      console.error('Error saving access token:', error);
    }
  }

  // Get stored access token
  async getStoredAccessToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('epic_access_token');
    } catch (error) {
      console.error('Error retrieving access token:', error);
      return null;
    }
  }

  // Clear access token and connected status
  async fetchAllPatientData(): Promise<any> {
    if (!this.accessToken) {
      throw new Error('Not connected to Epic. Please authenticate first.');
    }

    try {
      console.log('📥 Fetching all data from Epic...');

      // Fetch all data in parallel
      const [patient, medications, appointments, observations, allergies, conditions] = await Promise.all([
        this.getPatient().catch(e => {
          console.warn('Failed to fetch patient:', e);
          return null;
        }),
        this.getMedications().catch(e => {
          console.warn('Failed to fetch medications:', e);
          return [];
        }),
        this.getAppointments().catch(e => {
          console.warn('Failed to fetch appointments:', e);
          return [];
        }),
        this.getObservations().catch(e => {
          console.warn('Failed to fetch observations:', e);
          return [];
        }),
        this.getAllergies().catch(e => {
          console.warn('Failed to fetch allergies:', e);
          return [];
        }),
        this.getConditions().catch(e => {
          console.warn('Failed to fetch conditions:', e);
          return [];
        }),
      ]);

      console.log(`✅ Fetched Epic data:
        - Patient: ${patient?.name}
        - Medications: ${medications.length}
        - Appointments: ${appointments.length}
        - Observations: ${observations.length}
        - Allergies: ${allergies.length}
        - Conditions: ${conditions.length}`);

      return {
        patient,
        medications,
        appointments,
        observations,
        allergies,
        conditions,
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

    console.log(`✅ Converted ${records.length} records from Epic data`);
    return records;
  }

  async disconnect(): Promise<void> {
    try {
      await AsyncStorage.removeItem('epic_access_token');
      await AsyncStorage.removeItem('epic_connected');
      await AsyncStorage.removeItem('oauth_state');
      this.accessToken = null;
    } catch (error) {
      console.error('Error disconnecting:', error);
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
