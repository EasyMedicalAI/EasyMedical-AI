export interface LabMetric {
  id: string;
  name: string; // e.g., "LDL Cholesterol", "Blood Glucose"
  value: number | string;
  unit: string; // e.g., "mg/dL", "mg/L"
  normalRange?: {
    min: number;
    max: number;
  };
  status: 'normal' | 'abnormal' | 'unknown'; // auto-determined based on range
  date: string; // ISO date string
  recordId?: string; // Link to parent record
}

export interface LabResult {
  id: string;
  date: string;
  testName: string; // e.g., "Lipid Panel", "Complete Blood Count"
  metrics: LabMetric[];
  notes?: string;
}

export interface ExtractedData {
  medications?: string[];
  allergies?: string[];
  conditions?: string[];
  testResults?: Record<string, string>;
  dates?: Record<string, string>;
  labMetrics?: LabMetric[]; // Individual lab values for tracking trends
  [key: string]: any;
}

export interface MedicalRecord {
  id: string;
  // The health system a record was imported from. Records entered by hand or uploaded have none.
  source?: string;
  uploadDate: string;
  appointmentDate?: string; // For organizing records by date
  imageUri?: string;
  originalText?: string;
  specialty: string;
  provider: string;
  summary: string;
  reasonForVisit?: string; // Auto-extracted, user-editable
  findings?: string; // Extracted findings/results
  nextSteps?: string; // Extracted next steps/recommendations
  notes?: string; // User-added notes
  extractedData: ExtractedData;
  processed: boolean;
}

export interface VitalSigns {
  bloodPressure?: string;
  heartRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  lastUpdated?: string;
}

export interface UserHealthData {
  bloodType?: string;
  height?: string;
  weight?: string;
  weightHistory?: { date: string; value: number }[];
  bloodPressureHistory?: { date: string; systolic: number; diastolic: number }[];
  sleepHistory?: { date: string; hours: number }[];
  exerciseHistory?: { date: string; minutes: number; activity?: string }[];
  mealHistory?: { date: string; description: string; mealType?: string; tags?: string[] }[];
  drinkHistory?: { date: string; kind: 'water' | 'coffee' | 'alcohol' | 'sugary' }[];
  dietProfile?: string[];
  // lastDoseDate is the planned last day ("YYYY-MM-DD"); endDate is when the medication was stopped
  medicationHistory?: { name: string; dose?: string; frequency?: string; instructions?: string; startDate?: string; endDate?: string; lastDoseDate?: string; source?: 'epic'; reminderTimes?: string[]; skipDays?: number[] }[];
  // Taken doses: key "date|medication|HH:MM" -> when it was marked taken
  doseLog?: Record<string, string>;
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
  // How often to remind about upcoming appointments. Missing means standard.
  appointmentReminders?: 'off' | 'day' | 'standard' | 'frequent';
  appointments?: Array<{
    id: string;
    dateTime: string;
    doctorName: string;
    specialty: string;
  }>;
  vaccines?: Array<{
    name: string;
    date: string;
    nextDue?: string;
  }>;
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  insurance?: {
    provider: string;
    memberId: string;
    groupNumber?: string;
  };
  insurances?: { provider: string; memberId: string; groupNumber?: string; plan?: string; payerPhone?: string }[];
  birthday?: string;
  gender?: string;
  prescriptionMedications?: string[];
  otcMedications?: string[];
  pastConditions?: string[];
  pregnancies?: { year: string; outcome: string; complications: string[] }[];
  surgicalHistory?: { surgeryName: string; date: string }[];
  familyHistory?: { familyMember: string; condition: string }[];
  hospitalizations?: { reason: string; date: string }[];
  vitals?: VitalSigns;
  lastVisitDate?: string;
  pharmacy?: {
    name: string;
    address?: string;
    phone: string;
  };
  screenings?: Array<{
    type: string;
    date: string;
    notes?: string;
  }>;
}

export interface MedicalHub {
  records: MedicalRecord[];
  userData?: UserHealthData;
  lastSyncDate?: string;
}
