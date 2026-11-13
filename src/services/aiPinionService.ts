// AI-pinion: a chat that works out the most likely causes of how a person feels, with a top three.
// Only the typed conversation, and any lab results or imaging report the person types in, are sent to the backend.
// No records, names or dates of birth.
//
// Two calls: the chat gives the three possibilities first, then the articles for them are looked up.

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// A lab value the person typed in. The unit is required in the app, so values can be checked.
export interface AddedResult {
  test: string;
  value: string;
  unit: string;
  range: string;
  date: string;
}

export interface ChatExtras {
  results: AddedResult[];
  imaging: string;
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

// One of the three possibilities, before its articles are looked up
export interface AiPinionOutline {
  rank: number;
  name: string;
  why: string;
  askClinician: string[];
}

export interface AiPinionCandidate extends AiPinionOutline {
  articlesSay: AiPinionParagraph[];
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
  | { type: 'candidates'; candidates: AiPinionOutline[] };

export interface AiPinionArticleSummary {
  rank: number;
  name: string;
  articlesSay: AiPinionParagraph[];
  limitedEvidence: boolean;
}

export type AiPinionArticlesResponse =
  | { type: 'emergency'; text: string; safetyNote: string }
  | ({ type: 'result' } & Omit<AiPinionResult, 'candidates'> & { candidates: AiPinionArticleSummary[] });

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // A 404 means the server does not have this route yet (the backend change is not deployed)
  if (response.status === 404) {
    throw new Error('AI-pinion is not on the backend server yet. The backend update has to be deployed first.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'AI-pinion could not respond right now. Please try again later.');
  return data as T;
}

// The next question, an emergency stop, or the three possibilities
export function aiPinionTurn(messages: ChatTurn[], extras?: ChatExtras): Promise<AiPinionTurnResponse> {
  return postJson<AiPinionTurnResponse>('/api/ai-pinion/turn', {
    messages,
    results: extras?.results ?? [],
    imaging: extras?.imaging ?? '',
  });
}

// Recent articles for the named possibilities, with summaries that cite them
export function aiPinionArticles(messages: ChatTurn[], names: string[], extras?: ChatExtras): Promise<AiPinionArticlesResponse> {
  return postJson<AiPinionArticlesResponse>('/api/ai-pinion/articles', {
    messages,
    names,
    results: extras?.results ?? [],
    imaging: extras?.imaging ?? '',
  });
}
