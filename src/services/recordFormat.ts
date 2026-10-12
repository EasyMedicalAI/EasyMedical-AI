// One shape for every medical document. Uploads come back from the backend in this shape,
// and older records are converted into it for display, so every record reads the same way.
import { MedicalRecord } from '@/types/medical';

export type LabFlag = 'normal' | 'high' | 'low' | 'abnormal' | 'unknown';

export interface LabResult {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: LabFlag;
}

export interface Medication {
  name: string;
  dose: string;
  instructions: string;
}

export interface ExtractedRecord {
  documentType: string;
  specialty: string;
  date: string; // YYYY-MM-DD, or '' when the document has no date
  provider: string;
  facility: string;
  reason: string;
  summary: string;
  keyFindings: string[];
  labResults: LabResult[];
  medications: Medication[];
  diagnoses: string[];
  nextSteps: string[];
  confidence: 'high' | 'medium' | 'low';
}

const splitLines = (text?: string): string[] =>
  text ? text.split('\n').map((line) => line.trim()).filter(Boolean) : [];

// Calendar day (YYYY-MM-DD) for a stored date. Midnight-UTC dates keep their day exactly;
// anything else (for example a date picked in Edit mode) uses the device's local calendar day.
const toIsoDay = (value?: string): string => {
  if (!value) return '';
  const utcMidnight = value.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(\.000)?Z$/);
  if (utcMidnight) return utcMidnight[1];
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

// Builds the stored record from a backend extraction
export function toMedicalRecord(
  extracted: ExtractedRecord,
  options: { id: string; uploadDate: string; imageUris: string[]; chosenSpecialty?: string }
): MedicalRecord {
  const isLab = extracted.documentType === 'lab_report';
  const specialty = isLab ? 'Lab' : options.chosenSpecialty || extracted.specialty || 'Other';

  return {
    id: options.id,
    uploadDate: options.uploadDate,
    appointmentDate: extracted.date ? `${extracted.date}T00:00:00.000Z` : options.uploadDate,
    imageUri: options.imageUris[0],
    specialty,
    provider: extracted.provider || 'Unknown provider',
    summary: extracted.summary || extracted.reason || 'Medical record',
    reasonForVisit: extracted.reason || extracted.summary,
    findings: extracted.keyFindings.join('\n'),
    nextSteps: extracted.nextSteps.join('\n'),
    extractedData: {
      // Same fields the older records used, so My Labs, medication and condition lists keep working
      medications: extracted.medications.map((m) => [m.name, m.dose].filter(Boolean).join(' ')),
      allergies: [],
      conditions: extracted.diagnoses,
      testResults: Object.fromEntries(
        extracted.labResults.map((lab) => [lab.name, [lab.value, lab.unit].filter(Boolean).join(' ')])
      ),
      structured: extracted,
      imageUris: options.imageUris,
    },
    processed: true,
  };
}

// The one shape the detail views read. Records from before this format are converted on the fly.
export function getDisplayData(record: MedicalRecord): ExtractedRecord {
  const structured = record.extractedData?.structured as ExtractedRecord | undefined;
  // Edits made in the app (reason, summary, findings, next steps, date, provider) take priority
  if (structured) {
    return {
      ...structured,
      provider: record.provider || structured.provider,
      reason: record.reasonForVisit ?? structured.reason,
      summary: record.summary || structured.summary,
      keyFindings: record.findings !== undefined ? splitLines(record.findings) : structured.keyFindings,
      nextSteps: record.nextSteps !== undefined ? splitLines(record.nextSteps) : structured.nextSteps,
      date: record.appointmentDate ? toIsoDay(record.appointmentDate) : structured.date,
    };
  }

  const testResults = record.extractedData?.testResults || {};
  const isLab = record.specialty?.toLowerCase().includes('lab');
  return {
    documentType: isLab ? 'lab_report' : 'other',
    specialty: record.specialty || 'Other',
    date: toIsoDay(record.appointmentDate || record.uploadDate),
    provider: record.provider || '',
    facility: '',
    reason: record.reasonForVisit || '',
    summary: record.summary || '',
    keyFindings: splitLines(record.findings),
    labResults: Object.entries(testResults).map(([name, value]) => ({
      name,
      value: String(value),
      unit: '',
      referenceRange: '',
      flag: 'unknown' as LabFlag,
    })),
    medications: (record.extractedData?.medications || []).map((name: string) => ({ name, dose: '', instructions: '' })),
    diagnoses: record.extractedData?.conditions || [],
    nextSteps: splitLines(record.nextSteps),
    confidence: 'high',
  };
}

// Plain text version, for the camera preview and anywhere a single string is needed
export function toPlainText(extracted: ExtractedRecord): string {
  const lines: string[] = [];
  if (extracted.summary) lines.push(extracted.summary);
  if (extracted.keyFindings.length) {
    lines.push('', 'Key findings:', ...extracted.keyFindings.map((f) => `- ${f}`));
  }
  if (extracted.labResults.length) {
    lines.push(
      '',
      'Lab results:',
      ...extracted.labResults.map(
        (lab) =>
          `${lab.name}: ${[lab.value, lab.unit].filter(Boolean).join(' ')}${lab.referenceRange ? ` (${lab.referenceRange})` : ''}`
      )
    );
  }
  if (extracted.medications.length) {
    lines.push('', 'Medications:', ...extracted.medications.map((m) => `- ${[m.name, m.dose].filter(Boolean).join(' ')}`));
  }
  if (extracted.nextSteps.length) {
    lines.push('', 'Next steps:', ...extracted.nextSteps.map((s) => `- ${s}`));
  }
  return lines.join('\n');
}

// Date for display. Parsed as local time so the day doesn't shift.
export function formatRecordDate(day: string): string {
  if (!day) return 'Date not found';
  const date = new Date(`${day}T00:00:00`);
  return isNaN(date.getTime())
    ? day
    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
