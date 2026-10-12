// Connects EasyMedical to one or more EHR systems (Epic, Oracle Health, ...) over SMART on FHIR.
// Several systems can be connected at once. Reads and sync merge results from all of them.
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';
const CONNECTIONS_KEY = 'ehr_connections';
const EPIC_FHIR_BASE = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';

export interface EhrSystem {
  id: string;
  name: string;
  label: string;
  configured: boolean;
}

export interface EhrConnection {
  systemId: string;
  systemName: string;
  label: string; // prefix used on imported records, e.g. "Epic EHR"
  fhirBase: string;
  accessToken: string;
  patientId: string;
  connectedAt: string;
}

// One system's data as returned by the backend, kept separate so records can be labelled by source
export interface EhrSourceData {
  systemId: string;
  label: string;
  data: any;
}

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

class EhrService {
  private connections: EhrConnection[] = [];
  private loaded = false;

  // Loads saved connections. Migrates the single Epic connection saved by earlier builds.
  async load(): Promise<EhrConnection[]> {
    if (this.loaded) return this.connections;
    try {
      const raw = await AsyncStorage.getItem(CONNECTIONS_KEY);
      if (raw) {
        this.connections = JSON.parse(raw);
      } else {
        const legacyToken = await AsyncStorage.getItem('epic_access_token');
        if (legacyToken) {
          const legacyPatientId = (await AsyncStorage.getItem('epic_patient_id')) || '';
          this.connections = [
            {
              systemId: 'epic',
              systemName: 'Epic (MyChart)',
              label: 'Epic EHR',
              fhirBase: EPIC_FHIR_BASE,
              accessToken: legacyToken,
              patientId: legacyPatientId,
              connectedAt: new Date().toISOString(),
            },
          ];
          await this.persist();
          await AsyncStorage.multiRemove(['epic_access_token', 'epic_patient_id', 'epic_connected', 'oauth_state']);
        }
      }
    } catch (error) {
      console.error('Error loading EHR connections:', error);
    }
    this.loaded = true;
    return this.connections;
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(CONNECTIONS_KEY, JSON.stringify(this.connections));
  }

  async getConnections(): Promise<EhrConnection[]> {
    return this.load();
  }

  async hasAnyConnection(): Promise<boolean> {
    return (await this.load()).length > 0;
  }

  async isConnected(systemId: string): Promise<boolean> {
    return (await this.load()).some((c) => c.systemId === systemId);
  }

  // Systems the backend knows about. `configured` is false until the server has credentials for them.
  async listSystems(): Promise<EhrSystem[]> {
    const res = await fetch(`${BACKEND_URL}/api/ehr/systems`);
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    return res.json();
  }

  async generateAuthorizationUrl(systemId: string): Promise<{ url: string; state: string }> {
    const res = await fetch(`${BACKEND_URL}/api/ehr/${systemId}/authorize`);
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    const { url, state } = await res.json();
    return { url, state };
  }

  // Called after the browser closes. Returns null if the user did not finish signing in.
  async retrieveTokenByState(state: string): Promise<EhrConnection | null> {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ehr/token/${state}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.access_token || !data.system_id) return null;

      return {
        systemId: data.system_id,
        systemName: data.system_name || data.system_id,
        label: data.system_label || data.system_name || data.system_id,
        fhirBase: data.fhir_base,
        accessToken: data.access_token,
        patientId: data.patient || '',
        connectedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  // Adds a connection, or replaces the existing one for the same system
  async saveConnection(connection: EhrConnection): Promise<void> {
    await this.load();
    this.connections = [...this.connections.filter((c) => c.systemId !== connection.systemId), connection];
    await this.persist();
    console.log(`✅ Connected to ${connection.systemName}`);
  }

  async disconnect(systemId: string): Promise<void> {
    await this.load();
    this.connections = this.connections.filter((c) => c.systemId !== systemId);
    await this.persist();
    console.log(`✅ Disconnected from ${systemId}`);
  }

  // Legacy path: earlier builds handed back a bare Epic token. Kept so the old deep-link route still compiles.
  async handleOAuthCallback(token: string): Promise<void> {
    await this.saveConnection({
      systemId: 'epic',
      systemName: 'Epic (MyChart)',
      label: 'Epic EHR',
      fhirBase: EPIC_FHIR_BASE,
      accessToken: token,
      patientId: '',
      connectedAt: new Date().toISOString(),
    });
  }

  // Reads one FHIR resource path from one connected system. Returns null on any failure.
  private async fhirGet(c: EhrConnection, resourcePath: string): Promise<any | null> {
    if (!c.patientId) return null;
    const res = await fetch(`${c.fhirBase}${resourcePath}`, {
      headers: { Authorization: `Bearer ${c.accessToken}`, Accept: 'application/fhir+json' },
    });
    if (!res.ok) {
      console.warn(`⚠️ ${c.systemName}: ${resourcePath.split('?')[0]} returned ${res.status}`);
      return null;
    }
    return res.json();
  }

  // Runs a read against every connected system and merges the results. A failing system contributes nothing.
  private async forEachConnection<T>(read: (c: EhrConnection) => Promise<T[]>): Promise<T[]> {
    const connections = await this.load();
    const results = await Promise.all(connections.map((c) => read(c).catch(() => [] as T[])));
    return results.reduce((all, r) => all.concat(r), [] as T[]);
  }

  async getMedications(): Promise<Medication[]> {
    return this.forEachConnection(async (c) => {
      const data = await this.fhirGet(c, `/MedicationRequest?patient=${c.patientId}&status=active`);
      return (data?.entry || []).map((e: any) => ({
        id: e.resource.id,
        name: e.resource.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown',
        dosage: e.resource.dosageInstruction?.[0]?.text || 'No dosage info',
        date: e.resource.authoredOn || '',
        status: e.resource.status || 'active',
      }));
    });
  }

  async getAppointments(): Promise<Appointment[]> {
    return this.forEachConnection(async (c) => {
      const data = await this.fhirGet(c, `/Appointment?patient=${c.patientId}`);
      return (data?.entry || []).map((e: any) => {
        const startDate = new Date(e.resource.start);
        return {
          id: e.resource.id,
          description: e.resource.description || 'Appointment',
          provider: e.resource.participant?.[0]?.actor?.display || 'Unknown Provider',
          date: startDate.toLocaleDateString(),
          time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      });
    });
  }

  async getObservations(): Promise<Observation[]> {
    return this.forEachConnection(async (c) => {
      const data = await this.fhirGet(c, `/Observation?patient=${c.patientId}`);
      return (data?.entry || []).map((e: any) => {
        const resource = e.resource;
        let value = '';
        let unit = '';
        if (resource.valueQuantity) {
          value = resource.valueQuantity.value;
          unit = resource.valueQuantity.unit || '';
        } else if (resource.component) {
          value = resource.component.map((comp: any) => `${comp.code?.coding?.[0]?.display}: ${comp.valueQuantity?.value} ${comp.valueQuantity?.unit}`).join(', ');
        }
        return {
          id: resource.id,
          code: resource.code?.coding?.[0]?.display || 'Unknown',
          value: String(value),
          unit,
          date: resource.effectiveDateTime || '',
        };
      });
    });
  }

  async getAllergies(): Promise<Allergy[]> {
    return this.forEachConnection(async (c) => {
      const data = await this.fhirGet(c, `/AllergyIntolerance?patient=${c.patientId}`);
      return (data?.entry || []).map((e: any) => ({
        id: e.resource.id,
        allergen: e.resource.code?.coding?.[0]?.display || 'Unknown',
        reaction: e.resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || 'Unknown',
      }));
    });
  }

  async getConditions(): Promise<Condition[]> {
    return this.forEachConnection(async (c) => {
      const data = await this.fhirGet(c, `/Condition?patient=${c.patientId}`);
      return (data?.entry || []).map((e: any) => ({
        id: e.resource.id,
        name: e.resource.code?.coding?.[0]?.display || 'Unknown',
        onsetDate: e.resource.onsetDateTime || '',
        status: e.resource.status || 'unknown',
      }));
    });
  }

  // Pulls each connected system's clinical data through the backend. One failing system doesn't block the others.
  async fetchAllPatientData(): Promise<EhrSourceData[]> {
    const connections = await this.load();
    if (connections.length === 0) {
      throw new Error('No EHR system connected. Connect one in Settings first.');
    }

    const results: EhrSourceData[] = [];
    let lastError: unknown = null;

    for (const c of connections) {
      if (!c.patientId) {
        console.warn(`⚠️ ${c.systemName}: no patient ID saved, skipping. Reconnect to fix.`);
        continue;
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/ehr/${c.systemId}/patient-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: c.accessToken, patientId: c.patientId }),
        });
        if (!res.ok) {
          throw new Error(`Backend returned ${res.status}: ${await res.text()}`);
        }
        const data = await res.json();
        results.push({ systemId: c.systemId, label: c.label || c.systemName, data });
        console.log(`✅ ${c.systemName}: ${data.medications?.length || 0} meds, ${data.observations?.length || 0} observations, ${data.conditions?.length || 0} conditions, ${data.allergies?.length || 0} allergies`);
      } catch (error) {
        console.error(`❌ Failed to fetch ${c.systemName} data:`, error);
        lastError = error;
      }
    }

    if (results.length === 0 && lastError) {
      throw lastError;
    }
    return results;
  }

  // Converts one system's backend payload into medical records. `label` is the source name shown on records.
  convertToMedicalRecords(epicData: any, label: string, systemId: string): any[] {
    const records: any[] = [];
    const generateId = () => Math.random().toString(36).substring(2, 11);

    if (epicData.appointments && epicData.appointments.length > 0) {
      epicData.appointments.forEach((apt: Appointment) => {
        records.push({
          id: generateId(),
          uploadDate: apt.date,
          appointmentDate: apt.date,
          specialty: label,
          provider: apt.provider,
          summary: apt.description,
          reasonForVisit: apt.description,
          findings: `Appointment from ${label}`,
          nextSteps: '',
          notes: `Imported from ${label}`,
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults: {},
            dates: { 'Appointment Date': apt.date },
          },
          processed: true,
          source: systemId,
        });
      });
    }

    // Lab observations, grouped by date into one record per date
    if (epicData.observations && epicData.observations.length > 0) {
      const obsGroupedByDate: { [key: string]: any[] } = {};
      epicData.observations.forEach((obs: Observation) => {
        if (!obsGroupedByDate[obs.date]) {
          obsGroupedByDate[obs.date] = [];
        }
        obsGroupedByDate[obs.date].push(obs);
      });

      Object.entries(obsGroupedByDate).forEach(([date, obsList]) => {
        const testResults: { [key: string]: string } = {};
        obsList.forEach((obs: Observation) => {
          const value = obs.value || '';
          const unit = obs.unit ? ` ${obs.unit}` : '';
          testResults[obs.code] = `${value}${unit}`.trim();
        });

        records.push({
          id: generateId(),
          uploadDate: date,
          appointmentDate: date,
          specialty: 'Lab',
          provider: `${label} - Lab Results`,
          summary: `Lab Results from ${new Date(date).toLocaleDateString()}`,
          reasonForVisit: 'Lab Work',
          findings: `${obsList.length} lab values`,
          nextSteps: 'Review with provider',
          notes: `Imported from ${label}`,
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults,
            dates: { 'Test Date': date },
          },
          processed: true,
          source: systemId,
        });
      });
    }

    if (epicData.conditions && epicData.conditions.length > 0) {
      epicData.conditions.forEach((cond: Condition) => {
        records.push({
          id: generateId(),
          uploadDate: cond.onsetDate || new Date().toISOString(),
          appointmentDate: cond.onsetDate || new Date().toISOString(),
          specialty: 'Primary Care',
          provider: `${label} - Conditions`,
          summary: cond.name,
          reasonForVisit: cond.name,
          findings: `Status: ${cond.status}`,
          nextSteps: '',
          notes: `Imported from ${label}`,
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [cond.name],
            testResults: {},
            dates: { 'Onset Date': cond.onsetDate || '' },
          },
          processed: true,
          source: systemId,
        });
      });
    }

    if (epicData.procedures && epicData.procedures.length > 0) {
      epicData.procedures.forEach((proc: any) => {
        const performedDate = proc.performedDateTime || proc.performedDate || new Date().toISOString();
        records.push({
          id: generateId(),
          uploadDate: performedDate,
          appointmentDate: performedDate,
          specialty: 'Surgical',
          provider: `${label} - Procedures`,
          summary: proc.code?.coding?.[0]?.display || proc.code?.text || 'Procedure',
          reasonForVisit: proc.code?.coding?.[0]?.display || 'Medical Procedure',
          findings: `Status: ${proc.status}`,
          nextSteps: '',
          notes: proc.note?.[0]?.text || `Imported from ${label}`,
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults: {},
            dates: { 'Procedure Date': performedDate },
          },
          processed: true,
          source: systemId,
        });
      });
    }

    if (epicData.diagnostics && epicData.diagnostics.length > 0) {
      epicData.diagnostics.forEach((diag: any) => {
        const issuedDate = diag.issued || new Date().toISOString();
        const testResults: { [key: string]: string } = {};
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
          provider: `${label} - Diagnostic Report`,
          summary: `${diag.code?.coding?.[0]?.display || 'Diagnostic Report'} - ${diag.status}`,
          reasonForVisit: 'Diagnostic Testing',
          findings: `Status: ${diag.status}`,
          nextSteps: '',
          notes: diag.conclusion || `Imported from ${label}`,
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults,
            dates: { 'Report Date': issuedDate },
          },
          processed: true,
          source: systemId,
        });
      });
    }

    console.log(`✅ Converted ${records.length} records from ${label}`);
    return records;
  }
}

export const ehrService = new EhrService();
