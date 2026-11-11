// AI-pinion: a chat that works out the most likely causes of how a person feels, with a top three.
// Only the typed conversation is sent to the backend. No records, names or dates of birth.

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiPinionSource {
  id: string;
  pmid: string;
  title: string;
  journal: string;
  year: string;
  url: string;
}

export interface AiPinionParagraph {
  text: string;
  sources: AiPinionSource[];
}

export interface AiPinionCandidate {
  rank: number;
  name: string;
  why: string;
  articlesSay: AiPinionParagraph[];
  askClinician: string[];
  limitedEvidence: boolean;
}

export interface AiPinionResult {
  summary: string;
  candidates: AiPinionCandidate[];
  sources: AiPinionSource[];
  safetyNote: string;
}

export type AiPinionTurnResponse =
  | { type: 'question'; text: string; options?: string[] }
  | { type: 'emergency'; text: string; safetyNote: string }
  | ({ type: 'result' } & AiPinionResult);

export async function aiPinionTurn(messages: ChatTurn[]): Promise<AiPinionTurnResponse> {
  const response = await fetch(`${BACKEND_URL}/api/ai-pinion/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  // A 404 means the server does not have this route yet (the backend change is not deployed)
  if (response.status === 404) {
    throw new Error('AI-pinion is not on the backend server yet. The backend update has to be deployed first.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'AI-pinion could not respond right now. Please try again later.');
  return data as AiPinionTurnResponse;
}
