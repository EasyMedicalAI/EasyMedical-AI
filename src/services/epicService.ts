// Service to fetch patient data from Epic FHIR backend
// Epic Sandbox: https://fhir.epic.com/interconnect-fhir-oauth

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Configuration for Epic FHIR Sandbox
const FHIR_SERVER_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
const OAUTH_AUTHORIZE_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize';
const OAUTH_TOKEN_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token';

// Epic OAuth credentials (from app.json extra configuration)
const OAUTH_CLIENT_ID = 'ffe4b7c9-5ddb-4301-b6f5-122956d6e8e9';
const OAUTH_CLIENT_SECRET = 'YwP3NcjNH+S/BHgmBZXvQTl/QsJUXkSbuonJ3xY1yHRrMWv/ecb+aw8+eL3eRT91LANSxer5D4QkgnFt/Iw5rA==';
const OAUTH_REDIRECT_URI = 'http://localhost:8081/callback';

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

  // Generate authorization URL with state parameter for SMART on FHIR
  async generateAuthorizationUrl(): Promise<string> {
    const state = this.generateRandomString(32);
    await AsyncStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      response_type: 'code',
      redirect_uri: OAUTH_REDIRECT_URI,
      scope: 'openid fhirUser patient/Patient.read patient/MedicationRequest.read',
      state: state,
    });

    return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string, state: string): Promise<string> {
    try {
      // Verify state matches (CSRF protection)
      const storedState = await AsyncStorage.getItem('oauth_state');
      if (storedState !== state) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      // Exchange code for token
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: OAUTH_REDIRECT_URI,
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
      });

      const response = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Token exchange failed: ${errorData.error_description || 'Unknown error'}`);
      }

      const data = await response.json();
      const accessToken = data.access_token;

      // Save token and set in service
      await this.saveAccessToken(accessToken);
      this.setAccessToken(accessToken);

      // Save connected status
      await AsyncStorage.setItem('epic_connected', 'true');

      return accessToken;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  }

  // Initialize service with stored access token
  async initializeWithStoredToken(): Promise<boolean> {
    try {
      const token = await this.getStoredAccessToken();
      if (token) {
        this.setAccessToken(token);
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
