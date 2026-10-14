// Quick log: turns a typed or dictated note into entries the person confirms before anything is saved.
import { UserHealthData } from '../types/medical';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';

export interface LogEntry {
  type:
    | 'weight'
    | 'blood_pressure'
    | 'height'
    | 'blood_type'
    | 'birthday'
    | 'gender'
    | 'start_medication'
    | 'stop_medication'
    | 'add_condition'
    | 'add_allergy'
    | 'remove_condition'
    | 'remove_allergy'
    | 'log_sleep'
    | 'log_exercise'
    | 'log_meal'
    | 'add_appointment'
    | 'add_vaccine'
    | 'add_emergency_contact'
    | 'add_insurance'
    | 'set_pharmacy'
    | 'add_surgery'
    | 'add_family_history'
    | 'add_past_condition'
    | 'add_hospitalization'
    | 'add_screening'
    | 'unclear';
  date?: string; // YYYY-MM-DD
  weight_lbs?: number;
  systolic?: number;
  diastolic?: number;
  feet?: number;
  inches?: number;
  blood_type?: string;
  birthday?: string; // YYYY-MM-DD
  gender?: string;
  medication_name?: string;
  medication_kind?: 'prescription' | 'otc';
  dose?: string;
  instructions?: string;
  condition_name?: string;
  allergy_name?: string;
  allergy_reaction?: string;
  time?: string;
  doctor_name?: string;
  specialty?: string;
  vaccine_name?: string;
  next_due?: string;
  contact_name?: string;
  relationship?: string;
  phone?: string;
  provider?: string;
  member_id?: string;
  group_number?: string;
  pharmacy_name?: string;
  pharmacy_address?: string;
  pharmacy_phone?: string;
  surgery_name?: string;
  family_member?: string;
  reason?: string;
  screening_type?: string;
  notes?: string;
  hours?: number;
  minutes?: number;
  activity?: string;
  meal?: string;
  message?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Calls the backend, which asks Claude to turn the note into entries
export async function parseLogText(text: string, activeMedications: string[]): Promise<LogEntry[]> {
  const res = await fetch(`${BACKEND_URL}/api/assistant/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, today: localToday(), activeMedications }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not process that right now.');
  return body.entries || [];
}

// Finds the current medication a "stop" entry refers to. Exact match first, then a partial match.
export function matchActiveMedication(name: string | undefined, active: string[]): string | undefined {
  const wanted = (name || '').trim().toLowerCase();
  if (!wanted) return undefined;
  return (
    active.find((m) => m.trim().toLowerCase() === wanted) ||
    active.find((m) => m.trim().toLowerCase().includes(wanted) || wanted.includes(m.trim().toLowerCase()))
  );
}

// Every medication the person takes, prescription and over-the-counter, for matching stops
export const currentMedicationNames = (userData: UserHealthData): string[] => [
  ...(userData.prescriptionMedications || []),
  ...(userData.otcMedications || []),
];

const formatDay = (day?: string) => {
  if (!day) return '';
  const date = new Date(`${day}T12:00:00`);
  return isNaN(date.getTime()) ? day : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// YYYY-MM-DD -> "September 12, 1987", the format the health snapshot uses
const birthdayText = (day: string) => {
  const [y, m, d] = day.split('-').map((n) => parseInt(n, 10));
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

// Plain-language line for the confirmation card
export function describeEntry(entry: LogEntry, active: string[]): string {
  switch (entry.type) {
    case 'weight':
      return `Weight ${entry.weight_lbs} lbs, ${formatDay(entry.date)}`;
    case 'blood_pressure':
      return `Blood pressure ${entry.systolic}/${entry.diastolic} mmHg, ${formatDay(entry.date)}`;
    case 'height':
      return `Height ${entry.feet}'${entry.inches ?? 0}"`;
    case 'blood_type':
      return `Blood type ${entry.blood_type}`;
    case 'birthday':
      return `Birthday ${formatDay(entry.birthday)}`;
    case 'gender':
      return `Sex ${entry.gender}`;
    case 'start_medication':
      return `Start ${entry.medication_name}${entry.dose ? ` (${entry.dose})` : ''}${entry.medication_kind === 'otc' ? ' (over the counter)' : ''}, from ${formatDay(entry.date)}`;
    case 'stop_medication': {
      const match = matchActiveMedication(entry.medication_name, active);
      return match
        ? `Stop ${match}, ending ${formatDay(entry.date)}`
        : `Stop ${entry.medication_name}: not in your current medications, so it won't be saved`;
    }
    case 'add_condition':
      return `Add condition ${entry.condition_name}`;
    case 'add_allergy':
      return `Add allergy ${entry.allergy_name}${entry.allergy_reaction ? ` (${entry.allergy_reaction})` : ''}`;
    case 'log_sleep':
      return `Sleep ${entry.hours} hours, ${formatDay(entry.date)}`;
    case 'log_exercise':
      return `Exercise ${entry.minutes} minutes${entry.activity ? ` (${entry.activity})` : ''}, ${formatDay(entry.date)}`;
    case 'log_meal':
      return `Meal: ${entry.meal}, ${formatDay(entry.date)}`;
    case 'remove_condition':
      return `Remove condition ${entry.condition_name}`;
    case 'remove_allergy':
      return `Remove allergy ${entry.allergy_name}`;
    case 'add_appointment':
      return `Appointment ${formatDay(entry.date)}${entry.time ? ` at ${entry.time}` : ''}${entry.doctor_name ? ` with ${entry.doctor_name}` : ''}`;
    case 'add_vaccine':
      return `Vaccine ${entry.vaccine_name} on ${formatDay(entry.date)}${entry.next_due ? `, next due ${formatDay(entry.next_due)}` : ''}`;
    case 'add_emergency_contact':
      return `Emergency contact ${entry.contact_name}${entry.relationship ? ` (${entry.relationship})` : ''}, ${entry.phone}`;
    case 'add_insurance':
      return `Insurance ${entry.provider}${entry.member_id ? `, member ID ${entry.member_id}` : ''}`;
    case 'set_pharmacy':
      return `Pharmacy ${entry.pharmacy_name}, ${entry.pharmacy_phone}`;
    case 'add_surgery':
      return `Surgery ${entry.surgery_name}, ${formatDay(entry.date)}`;
    case 'add_family_history':
      return `Family history: ${entry.family_member}, ${entry.condition_name}`;
    case 'add_past_condition':
      return `Past condition ${entry.condition_name}`;
    case 'add_hospitalization':
      return `Hospitalization for ${entry.reason}, ${formatDay(entry.date)}`;
    case 'add_screening':
      return `Screening ${entry.screening_type}, ${formatDay(entry.date)}`;
    default:
      return entry.message || 'Could you say that another way?';
  }
}

// Only entries that can be saved. Unclear entries and stops that match nothing are left out.
export function savableEntries(entries: LogEntry[], active: string[]): LogEntry[] {
  return entries.filter((e) => {
    if (e.type === 'unclear') return false;
    if (e.type === 'stop_medication') return !!matchActiveMedication(e.medication_name, active);
    return true;
  });
}

// Saved date: today keeps the current time, any other day is stored at midday
const toStamp = (day?: string) => {
  if (!day || day === localToday()) return new Date().toISOString();
  const [y, m, d] = day.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
};

// "Mon YYYY", the format surgery and hospitalization dates use
const monthYear = (day?: string) => {
  if (!day) return '';
  const [y, m] = day.split('-').map((n) => parseInt(n, 10));
  return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
};

// Appointments use "Month D, YYYY • time"
const appointmentText = (day?: string, time?: string) => {
  const [y, m, d] = (day || '').split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return time || '';
  const date = `${MONTHS[m - 1]} ${d}, ${y}`;
  return time ? `${date} • ${time}` : date;
};

const withoutItem = (list: string[], item: string) => list.filter((x) => x !== item);

// Returns the profile with the confirmed entries applied
export function applyLogEntries(userData: UserHealthData, entries: LogEntry[]): UserHealthData {
  const next: UserHealthData = {
    ...userData,
    vitals: { ...userData.vitals } as UserHealthData['vitals'],
    weightHistory: [...(userData.weightHistory || [])],
    bloodPressureHistory: [...(userData.bloodPressureHistory || [])],
    prescriptionMedications: [...(userData.prescriptionMedications || [])],
    otcMedications: [...(userData.otcMedications || [])],
    medicationHistory: [...(userData.medicationHistory || [])],
    conditions: [...(userData.conditions || [])],
    allergies: [...(userData.allergies || [])],
  };

  for (const e of entries) {
    if (e.type === 'weight' && e.weight_lbs !== undefined) {
      next.weightHistory!.push({ date: toStamp(e.date), value: e.weight_lbs });
      next.weight = `${e.weight_lbs} lbs`;
    } else if (e.type === 'blood_pressure' && e.systolic !== undefined && e.diastolic !== undefined) {
      next.bloodPressureHistory!.push({ date: toStamp(e.date), systolic: e.systolic, diastolic: e.diastolic });
      next.vitals = { ...next.vitals, bloodPressure: `${e.systolic}/${e.diastolic} mmHg` };
    } else if (e.type === 'height' && e.feet !== undefined) {
      next.height = `${e.feet}'${e.inches ?? 0}"`;
    } else if (e.type === 'blood_type' && e.blood_type) {
      next.bloodType = e.blood_type;
    } else if (e.type === 'birthday' && e.birthday) {
      next.birthday = birthdayText(e.birthday);
    } else if (e.type === 'gender' && e.gender) {
      next.gender = e.gender;
    } else if (e.type === 'add_condition' && e.condition_name) {
      if (!next.conditions!.some((c) => c.trim().toLowerCase() === e.condition_name!.trim().toLowerCase())) {
        next.conditions!.push(e.condition_name);
      }
    } else if (e.type === 'add_allergy' && e.allergy_name) {
      const text = e.allergy_reaction ? `${e.allergy_name} (${e.allergy_reaction})` : e.allergy_name;
      if (!next.allergies!.some((a) => a.trim().toLowerCase() === text.trim().toLowerCase())) {
        next.allergies!.push(text);
      }
    } else if (e.type === 'start_medication' && e.medication_name) {
      const list = e.medication_kind === 'otc' ? next.otcMedications! : next.prescriptionMedications!;
      if (!list.some((m) => m.trim().toLowerCase() === e.medication_name!.trim().toLowerCase())) {
        list.push(e.medication_name);
      }
      next.medicationHistory!.push({
        name: e.medication_name,
        dose: e.dose || undefined,
        instructions: e.instructions || undefined,
        startDate: e.date,
      });
    } else if (e.type === 'log_sleep' && e.hours !== undefined) {
      next.sleepHistory = [...((next.sleepHistory as any[]) || []), { date: toStamp(e.date), hours: e.hours }];
    } else if (e.type === 'log_exercise' && e.minutes !== undefined) {
      next.exerciseHistory = [...((next.exerciseHistory as any[]) || []), { date: toStamp(e.date), minutes: e.minutes, activity: e.activity || undefined }];
    } else if (e.type === 'log_meal' && e.meal) {
      next.mealHistory = [...((next.mealHistory as any[]) || []), { date: toStamp(e.date), description: e.meal }];
    } else if (e.type === 'remove_condition' && e.condition_name) {
      const wanted = e.condition_name.trim().toLowerCase();
      next.conditions = next.conditions!.filter((c) => c.trim().toLowerCase() !== wanted);
    } else if (e.type === 'remove_allergy' && e.allergy_name) {
      // Allergies may be saved with a reaction, for example "Penicillin (rash)"
      const wanted = e.allergy_name.trim().toLowerCase();
      next.allergies = next.allergies!.filter((a) => {
        const text = a.trim().toLowerCase();
        return text !== wanted && !text.startsWith(wanted + ' (');
      });
    } else if (e.type === 'add_appointment') {
      next.appointments = [...(next.appointments || []), {
        id: String(Date.now() + Math.floor(Math.random() * 1000)),
        dateTime: appointmentText(e.date, e.time),
        doctorName: e.doctor_name || '',
        specialty: e.specialty || '',
      }];
    } else if (e.type === 'add_vaccine' && e.vaccine_name) {
      next.vaccines = [...(next.vaccines || []), {
        name: e.vaccine_name,
        date: formatDay(e.date),
        nextDue: e.next_due ? formatDay(e.next_due) : undefined,
      }];
    } else if (e.type === 'add_emergency_contact' && e.contact_name) {
      next.emergencyContacts = [...(next.emergencyContacts || []), {
        name: e.contact_name,
        relationship: e.relationship || '',
        phone: e.phone || '',
      }];
    } else if (e.type === 'add_insurance' && e.provider) {
      next.insurances = [...(next.insurances || []), {
        provider: e.provider,
        memberId: e.member_id || '',
        groupNumber: e.group_number || '',
      }];
    } else if (e.type === 'set_pharmacy' && e.pharmacy_name) {
      next.pharmacy = { name: e.pharmacy_name, address: e.pharmacy_address || '', phone: e.pharmacy_phone || '' };
    } else if (e.type === 'add_surgery' && e.surgery_name) {
      next.surgicalHistory = [...((next.surgicalHistory as any[]) || []), { surgeryName: e.surgery_name, date: monthYear(e.date) }];
    } else if (e.type === 'add_family_history' && e.family_member && e.condition_name) {
      next.familyHistory = [...((next.familyHistory as any[]) || []), { familyMember: e.family_member, condition: e.condition_name }];
    } else if (e.type === 'add_past_condition' && e.condition_name) {
      next.pastConditions = [...((next.pastConditions as string[]) || []), e.condition_name];
    } else if (e.type === 'add_hospitalization' && e.reason) {
      next.hospitalizations = [...((next.hospitalizations as any[]) || []), { reason: e.reason, date: monthYear(e.date) }];
    } else if (e.type === 'add_screening' && e.screening_type) {
      next.screenings = [...(next.screenings || []), { type: e.screening_type, date: formatDay(e.date), notes: e.notes || undefined }];
    } else if (e.type === 'stop_medication') {
      const match = matchActiveMedication(e.medication_name, [...next.prescriptionMedications!, ...next.otcMedications!]);
      if (!match) continue;
      next.prescriptionMedications = withoutItem(next.prescriptionMedications!, match);
      next.otcMedications = withoutItem(next.otcMedications!, match);
      const open = next.medicationHistory!.find((m) => m.name === match && !m.endDate);
      if (open) {
        open.endDate = e.date;
      } else {
        next.medicationHistory!.push({ name: match, endDate: e.date });
      }
    }
  }
  return next;
}
