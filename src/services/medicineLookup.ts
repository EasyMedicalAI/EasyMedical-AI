// Find medications cheaper: looks up a medication by name in RxNorm (the National Library of Medicine's drug database).
// Only the medication name is sent. No ZIP code, name or other personal details.

export interface MedicineMatch {
  rxcui: string;
  name: string;
}

export interface GenericOptions {
  // The generic (ingredient) name, such as "atorvastatin"
  genericName: string | null;
  // Generic products with their strength and form, such as "atorvastatin 20 MG Oral Tablet"
  products: MedicineMatch[];
  // How many generic products exist, including any cut from the list
  totalProducts: number;
}

const RXNAV_URL = 'https://rxnav.nlm.nih.gov/REST';
// Long lists are cut to this many products. The screen says how many were left out.
const MAX_PRODUCTS = 40;

// Medications whose names match the typed text, best matches first
export async function searchMedicines(term: string): Promise<MedicineMatch[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const params = new URLSearchParams({ term: trimmed, maxEntries: '10' });
  const response = await fetch(`${RXNAV_URL}/approximateTerm.json?${params.toString()}`);
  if (!response.ok) throw new Error('The drug database is not responding right now.');
  const data = await response.json();
  const candidates: any[] = data?.approximateGroup?.candidate || [];

  // Some matches have no name. Duplicates of the same name are kept once.
  const seen = new Set<string>();
  const matches: MedicineMatch[] = [];
  for (const candidate of candidates) {
    const name: string | undefined = candidate.name;
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    matches.push({ rxcui: String(candidate.rxcui), name });
  }
  return matches;
}

// The generic name and the generic products (with strength and form) for a medication
export async function genericOptions(rxcui: string): Promise<GenericOptions> {
  const response = await fetch(`${RXNAV_URL}/rxcui/${encodeURIComponent(rxcui)}/allrelated.json`);
  if (!response.ok) throw new Error('The drug database is not responding right now.');
  const data = await response.json();
  const groups: any[] = data?.allRelatedGroup?.conceptGroup || [];

  const ingredient = groups.find((g) => g.tty === 'IN')?.conceptProperties?.[0]?.name || null;
  const products: MedicineMatch[] = (groups.find((g) => g.tty === 'SCD')?.conceptProperties || [])
    .map((p: any) => ({ rxcui: String(p.rxcui), name: p.name }))
    .sort((a: MedicineMatch, b: MedicineMatch) => a.name.localeCompare(b.name));

  return { genericName: ingredient, products: products.slice(0, MAX_PRODUCTS), totalProducts: products.length };
}
