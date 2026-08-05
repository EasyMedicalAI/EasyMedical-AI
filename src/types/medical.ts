export interface ExtractedData {
  medications?: string[];
  allergies?: string[];
  conditions?: string[];
  testResults?: Record<string, string>;
  dates?: Record<string, string>;
  [key: string]: any;
}

export interface MedicalRecord {
  id: string;
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
  conditions?: string[];
  allergies?: string[];
  medications?: string[];
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
