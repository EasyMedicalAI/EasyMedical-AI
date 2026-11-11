// Trusted patient information on a condition, from MedlinePlus (the National Library of Medicine's consumer health site).
// Only the condition name is sent. No name, record, or other personal details.

export interface HealthTopic {
  title: string;
  url: string;
  summary: string;
}

const SEARCH_URL = 'https://wsearch.nlm.nih.gov/ws/query';
const MAX_TOPICS = 3;
// Look past the first few results, so a close match is not missed
const SEARCH_RESULTS = 8;
const MAX_SUMMARY_CHARACTERS = 480;

// The MedlinePlus topics that match the condition name, with a short plain-language summary.
// Search matches single words, so only topics whose title is the condition (or its parent term) are kept.
export async function healthTopics(condition: string): Promise<HealthTopic[]> {
  const term = cleanCondition(condition);
  if (!term) return [];
  const params = new URLSearchParams({ db: 'healthTopics', term, retmax: String(SEARCH_RESULTS) });
  const response = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('MedlinePlus is not responding right now.');
  const xml = await response.text();

  const topics: HealthTopic[] = [];
  const documents = xml.split('<document ').slice(1);
  for (const doc of documents) {
    const url = doc.match(/url="([^"]+)"/)?.[1];
    const title = contentOf(doc, 'title');
    if (!url || !title) continue;
    if (!isRelevant(title, term)) continue;
    const summary = truncate(contentOf(doc, 'FullSummary'));
    topics.push({ title, url, summary });
    if (topics.length === MAX_TOPICS) break;
  }
  return topics;
}

// Removes wording that search does not match, such as codes and "unspecified".
// "Arthritis, psoriatic" becomes "psoriatic arthritis".
export function cleanCondition(raw: string): string {
  const text = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,?\s*\b(unspecified|nos|not otherwise specified)\b/gi, ' ')
    .replace(/\bof (multiple|several|unspecified) sites?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[,\s]+$/, '')
    .trim();
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  const ordered = parts.length === 2 ? `${parts[1]} ${parts[0]}` : text;
  return ordered.toLowerCase();
}

// A topic is relevant when its title is the condition, or a broader term inside it
// (for example "Arthritis" for "psoriatic arthritis"). Narrower topics such as "Juvenile Arthritis"
// or "Pulmonary Hypertension" are left out, and so are short titles that could match by chance.
function isRelevant(title: string, term: string): boolean {
  const t = title.toLowerCase();
  return t === term || (t.length >= 4 && term.includes(t));
}

// The text inside one <content name="..."> element, with the search highlighting and HTML tags removed
function contentOf(doc: string, name: string): string {
  const match = doc.match(new RegExp(`<content name="${name}">([\\s\\S]*?)</content>`));
  return match ? clean(match[1]) : '';
}

// The tags arrive escaped (for example &lt;span ...&gt;), so decode first, then remove the tags
function clean(raw: string): string {
  const decoded = decodeEntities(raw);
  const withoutTags = decodeEntities(decoded.replace(/<[^>]+>/g, ' '));
  return withoutTags.replace(/\s+/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Keeps whole sentences where possible, so the summary never stops mid-thought
function truncate(text: string): string {
  if (text.length <= MAX_SUMMARY_CHARACTERS) return text;
  const cut = text.slice(0, MAX_SUMMARY_CHARACTERS);
  const lastSentence = cut.search(/[.!?][^.!?]*$/);
  if (lastSentence > MAX_SUMMARY_CHARACTERS * 0.5) return cut.slice(0, lastSentence + 1);
  return `${cut.replace(/\s+\S*$/, '')}…`;
}
