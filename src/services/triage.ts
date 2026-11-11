// Symptom triage: how urgently to get care and which kind of clinician to see. It never names a condition.
// Only what the person typed, and the body areas they picked, are sent to the backend.

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';

export type Urgency = 'emergency' | 'urgent_care_today' | 'see_doctor_this_week' | 'routine';

export interface TriageResult {
  urgency: Urgency;
  where_to_go: string;
  reasons: string[];
  questions_for_clinician: string[];
  missing_information: string[];
  confidence: 'low' | 'medium' | 'high';
  // The trusted sources behind the reasons, with links
  sources?: { title: string; url: string }[];
}

export interface TriageResponse {
  emergency: boolean;
  result: TriageResult;
  safetyNote: string;
}

export async function triage(description: string, areas: string[]): Promise<TriageResponse> {
  const response = await fetch(`${BACKEND_URL}/api/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, areas }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Could not work that out right now. Please try again.');
  return data as TriageResponse;
}
