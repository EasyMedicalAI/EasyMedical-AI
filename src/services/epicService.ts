// Service to fetch patient data from Epic FHIR backend
// Epic Sandbox: https://fhir.epic.com/interconnect-fhir-oauth

// Configuration for Epic FHIR Sandbox
const FHIR_SERVER_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
const OAUTH_AUTHORIZE_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize';
const OAUTH_TOKEN_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token';

// Note: You'll need to register your app with Epic to get these credentials
// Register at: https://fhir.epic.com/interconnect-fhir-oauth/
// For testing, use the publicly available sandbox patient
const OAUTH_CLIENT_ID = process.env.REACT_APP_EPIC_CLIENT_ID || 'YOUR_CLIENT_ID';
const OAUTH_CLIENT_SECRET = process.env.REACT_APP_EPIC_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const OAUTH_REDIRECT_URI = process.env.REACT_APP_EPIC_REDIRECT_URI || 'http://localhost:8081/callback';

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
}

export const epicService = new EpicService();
