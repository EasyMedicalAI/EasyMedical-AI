// Condition names for the add-condition picker, from the National Library of Medicine's condition list.
// Only the text being typed is sent. The list matches the start of each word, so "psoriatic" finds "Arthritis - psoriatic"
// only when the search is shorter than the name; misspelled words return nothing.

export interface ConditionName {
  // The standard name, used for the record and for trial searches
  name: string;
  // A plain-language name when the list has one, such as "High blood pressure" for "Hypertension"
  plainName?: string;
}

const CONDITIONS_URL = 'https://clinicaltables.nlm.nih.gov/api/conditions/v3/search';
// Shorter text matches too many names to be useful
export const MIN_CHARACTERS = 2;
const MAX_RESULTS = 10;

export async function searchConditionNames(term: string): Promise<ConditionName[]> {
  const trimmed = term.trim();
  if (trimmed.length < MIN_CHARACTERS) return [];
  const params = new URLSearchParams({
    terms: trimmed,
    sf: 'primary_name,consumer_name',
    df: 'primary_name,consumer_name',
    maxList: String(MAX_RESULTS),
  });
  const response = await fetch(`${CONDITIONS_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('The condition list is not responding right now.');
  const data = await response.json();
  // The response is [count, codes, null, rows]. Each row is [standard name, plain name].
  const rows: unknown[] = Array.isArray(data?.[3]) ? data[3] : [];

  const seen = new Set<string>();
  const names: ConditionName[] = [];
  for (const row of rows) {
    const [name, plainName] = Array.isArray(row) ? row : [];
    if (typeof name !== 'string' || !name || seen.has(name)) continue;
    seen.add(name);
    const plain = typeof plainName === 'string' && plainName !== name ? plainName : undefined;
    names.push({ name, plainName: plain });
  }
  return names;
}
