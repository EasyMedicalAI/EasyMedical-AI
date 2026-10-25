// Connects EasyMedical to one or more EHR systems (Epic, Oracle Health, ...) over SMART on FHIR.
// Several systems can be connected at once. Reads and sync merge results from all of them.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { medicationNameFrom } from './medicationName';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';
const CONNECTIONS_KEY = 'ehr_connections';
const OVERRIDES_KEY = 'ehr_overrides';
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
  expired?: boolean; // set when Epic refuses the sign-in; cleared by reconnecting
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
  start?: string; // ISO start time from Epic, used for reminders
}

export interface Observation {
  id: string;
  code: string;
  value: string;
  unit: string;
  referenceRange?: string;
  systolic?: number;
  diastolic?: number;
  date: string;
}

// Vital signs are tracked on the Home screen, not as lab results
export const isVitalObservation = (obs: Observation) =>
  /weight|blood pressure|heart rate|pulse|temperature|respirat|oxygen|spo2|height|body mass|bmi/i.test(obs.code);

export const isWeightObservation = (obs: Observation) =>
  /body weight|^weight/i.test(obs.code) && !/height/i.test(obs.code);

// Height from Epic, as feet and inches like 5'10" (the form the profile uses). Uses the most recent reading.
export const heightFromObservations = (observations: Observation[]): string => {
  const readings = observations
    .filter((o) => /^height/i.test(o.code || '') && !isNaN(Number(o.value)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (readings.length === 0) return '';
  const { value, unit } = readings[0];
  const inches = /cm/i.test(unit || '') ? Number(value) / 2.54 : Number(value);
  const total = Math.round(inches);
  return `${Math.floor(total / 12)}'${total % 12}"`;
};

// Epic records these when an allergy wasn't asked for or isn't known. They aren't allergies, so they aren't shown.
const PLACEHOLDER_ALLERGY = /^(patient not asked|unknown|no known|nkda|nka|none|no allergies)/i;

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

// Edits made in this app to items that come from Epic. Epic's own data is never changed.
export interface EpicOverride {
  primary?: string;
  secondary?: string;
  // Removed in this app. The item stays in Epic and is only hidden here.
  hidden?: boolean;
}

// Note text from Epic is usually HTML. This keeps the words and drops the markup.
// Turns HTML character codes like &amp;, &#183;, and &#x2022; into the characters they stand for
export const decodeEntities = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const plainTextFromHtml = (html: string): string =>
  decodeEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

// The group a note belongs to on the Records screen, from its type code or its title
export const noteSpecialty = (typeCodes: string[], title: string): string => {
  if (typeCodes.includes('11506-3') || /progress/i.test(title)) return 'Progress Notes';
  if (typeCodes.includes('18748-4') || /imaging|radiolog|x-ray|\bct\b|\bmri\b/i.test(title)) return 'Imaging';
  return 'Clinical Notes';
};

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
      console.log('🔐 Granted scopes:', data.scope);
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

  async getOverrides(): Promise<Record<string, EpicOverride>> {
    try {
      const raw = await AsyncStorage.getItem(OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      console.error('Error loading edits:', error);
      return {};
    }
  }

  async saveOverride(key: string, override: EpicOverride): Promise<Record<string, EpicOverride>> {
    const all = await this.getOverrides();
    all[key] = override;
    await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(all));
    return all;
  }

  async clearOverride(key: string): Promise<Record<string, EpicOverride>> {
    const all = await this.getOverrides();
    delete all[key];
    await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(all));
    return all;
  }

  // Reads one FHIR resource path from one connected system. Returns null on any failure.
  // Marks a connection as expired so the app can ask the person to reconnect
  private async markExpired(systemId: string): Promise<void> {
    await this.load();
    this.connections = this.connections.map((c) => (c.systemId === systemId ? { ...c, expired: true } : c));
    await this.persist();
  }

  async getExpiredSystemIds(): Promise<string[]> {
    return (await this.load()).filter((c) => c.expired).map((c) => c.systemId);
  }

  // Reads a FHIR search and follows its "next" links, so long result lists aren't cut off after one page
  private async fhirGet(c: EhrConnection, resourcePath: string): Promise<any | null> {
    if (!c.patientId) return null;
    const headers = { Authorization: `Bearer ${c.accessToken}`, Accept: 'application/fhir+json' };
    const MAX_PAGES = 20;
    let url: string | undefined = `${c.fhirBase}${resourcePath}`;
    let bundle: any = null;
    let pages = 0;
    while (url && pages < MAX_PAGES) {
      const res = await fetch(url, { headers });
      if (res.status === 401) {
        await this.markExpired(c.systemId);
        return bundle;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`⚠️ ${c.systemName}: ${resourcePath.split('?')[0]} returned ${res.status}${body ? ` — ${body.slice(0, 400)}` : ''}`);
        return bundle;
      }
      const page = await res.json();
      pages++;
      if (!Array.isArray(page.entry)) {
        // A single resource, not a search result
        return bundle ?? page;
      }
      bundle = bundle
        ? { ...bundle, entry: [...(bundle.entry || []), ...page.entry] }
        : page;
      url = page.link?.find((l: any) => l.relation === 'next')?.url;
    }
    if (url) console.warn(`⚠️ ${c.systemName}: stopped after ${MAX_PAGES} pages`);
    return bundle;
  }

  // Runs a read against every connected system and merges the results. A failing system contributes nothing.
  private async forEachConnection<T>(read: (c: EhrConnection) => Promise<T[]>): Promise<T[]> {
    const connections = await this.load();
    const results = await Promise.all(connections.map((c) => read(c).catch(() => [] as T[])));
    return results.reduce((all, r) => all.concat(r), [] as T[]);
  }

  // Some Epic prescriptions only point to a separate Medication record, which holds the name
  private async medicationNameFromReference(c: EhrConnection, request: any): Promise<string> {
    const reference: string | undefined = request?.medicationReference?.reference;
    if (!reference) return '';
    const medication = await this.fhirGet(c, `/${reference}`).catch(() => null);
    return medication?.code?.coding?.[0]?.display || medication?.code?.text || '';
  }

  async getMedications(): Promise<Medication[]> {
    return this.forEachConnection(async (c) => {
      const data = await this.fhirGet(c, `/MedicationRequest?patient=${c.patientId}&status=active`);
      const entries: any[] = data?.entry || [];
      // Medications without a name (from Epic or its linked record) are left out, since they can't be identified
      const resolved = await Promise.all(
        entries.map(async (e: any) => ({
          entry: e,
          name: medicationNameFrom(e.resource) || (await this.medicationNameFromReference(c, e.resource)),
        }))
      );
      return resolved
        .filter(({ name }) => name)
        .map(({ entry, name }) => ({
          id: entry.resource.id,
          name,
          dosage: entry.resource.dosageInstruction?.[0]?.text || 'No dosage info',
          date: entry.resource.authoredOn || '',
          status: entry.resource.status || 'active',
        }));
    });
  }

  async getAppointments(): Promise<Appointment[]> {
    return this.forEachConnection(async (c) => {
      const data = await this.fhirGet(c, `/Appointment?patient=${c.patientId}`);
      // An appointment without a valid start time can't be placed on the calendar, so it isn't shown
      return (data?.entry || [])
        .map((e: any) => e.resource)
        .filter((r: any) => r && !isNaN(new Date(r.start).getTime()))
        .map((r: any, index: number) => {
          const startDate = new Date(r.start);
          return {
            id: r.id || `${r.start}-${index}`,
            description: r.description || 'Appointment',
            provider: r.participant?.[0]?.actor?.display || 'Unknown Provider',
            date: startDate.toLocaleDateString(),
            time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            start: r.start,
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
      return (data?.entry || [])
        .map((e: any) => ({
          id: e.resource.id,
          allergen: e.resource.code?.coding?.[0]?.display || 'Unknown',
          reaction: e.resource.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || 'Unknown',
        }))
        .filter((a: Allergy) => !PLACEHOLDER_ALLERGY.test(a.allergen));
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
        if (res.status === 401) {
          await this.markExpired(c.systemId);
          throw new Error('Epic sign-in has expired. Reconnect Epic in Settings.');
        }
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

    // Lab observations, grouped by date into one record per date
    if (epicData.observations && epicData.observations.length > 0) {
      const obsGroupedByDate: { [key: string]: any[] } = {};
      epicData.observations.filter((obs: Observation) => !isVitalObservation(obs)).forEach((obs: Observation) => {
        if (!obsGroupedByDate[obs.date]) {
          obsGroupedByDate[obs.date] = [];
        }
        obsGroupedByDate[obs.date].push(obs);
      });

      Object.entries(obsGroupedByDate).forEach(([date, obsList]) => {
        const testResults: { [key: string]: string } = {};
        const testRanges: { [key: string]: string } = {};
        obsList.forEach((obs: Observation) => {
          const value = obs.value || '';
          const unit = obs.unit ? ` ${obs.unit}` : '';
          testResults[obs.code] = `${value}${unit}`.trim();
          if (obs.referenceRange) {
            testRanges[obs.code] = obs.referenceRange;
          }
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
            testRanges,
            dates: { 'Test Date': date },
          },
          processed: true,
          source: systemId,
        });
      });
    }

    // Clinical notes. The text comes from the note's Binary link, and is kept as plain text.
    if (epicData.documents && epicData.documents.length > 0) {
      epicData.documents.forEach((doc: any) => {
        if (!doc.noteText) return;
        const noteDate = doc.date || new Date().toISOString();
        const title = doc.description || doc.type?.text || doc.type?.coding?.[0]?.display || 'Clinical note';
        records.push({
          id: generateId(),
          uploadDate: noteDate,
          appointmentDate: noteDate,
          specialty: noteSpecialty((doc.type?.coding || []).map((c: any) => c.code), title),
          provider: doc.author?.[0]?.display || label,
          summary: title,
          reasonForVisit: title,
          findings: '',
          nextSteps: '',
          originalText: plainTextFromHtml(doc.noteText),
          notes: `Imported from ${label}`,
          extractedData: {
            medications: [],
            allergies: [],
            conditions: [],
            testResults: {},
            dates: { 'Note Date': noteDate },
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
