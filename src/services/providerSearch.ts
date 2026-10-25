// Find a doctor: searches the public NPI provider registry by specialty and ZIP code.
// The registry doesn't say which insurers a doctor accepts, so network status comes from a separate check (see insuranceNetwork.ts).
// Only the specialty and ZIP code are sent. No name, member ID or other personal details.

export const SPECIALTIES: { label: string; taxonomy: string }[] = [
  { label: 'Primary care', taxonomy: 'Family Medicine' },
  { label: 'Internal medicine', taxonomy: 'Internal Medicine' },
  { label: 'Cardiology', taxonomy: 'Cardiovascular Disease' },
  { label: 'Dermatology', taxonomy: 'Dermatology' },
  { label: 'OB/GYN', taxonomy: 'Obstetrics & Gynecology' },
  { label: 'Pediatrics', taxonomy: 'Pediatrics' },
  { label: 'Psychiatrist', taxonomy: 'Psychiatry' },
  { label: 'Psychologist', taxonomy: 'Psychologist' },
  { label: 'Dentist', taxonomy: 'Dentist' },
  { label: 'Ophthalmologist', taxonomy: 'Ophthalmology' },
];

export interface ProviderResult {
  npi: string;
  name: string;
  specialty: string;
  address: string;
  zip: string;
  phone?: string;
}

const REGISTRY_URL = 'https://npiregistry.cms.hhs.gov/api/';
const PAGE_SIZE = 50;
// Pages to fetch per search. The registry returns about 50 per page, and fewer than a page means there are no more.
const MAX_PAGES = 4;

// The office location for a registry entry
const locationOf = (result: any) =>
  (result.addresses || []).find((a: any) => a.address_purpose === 'LOCATION') || (result.addresses || [])[0] || {};

// Fetches one page of registry results
async function fetchPage(taxonomy: string, zip: string, skip: number): Promise<any[]> {
  const params = new URLSearchParams({
    version: '2.1',
    enumeration_type: 'NPI-1',
    taxonomy_description: taxonomy,
    postal_code: zip,
    limit: String(PAGE_SIZE),
    skip: String(skip),
  });
  const response = await fetch(`${REGISTRY_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('The provider registry is not responding right now.');
  const data = await response.json();
  return data.results || [];
}

// Turns the registry's response into the few fields the screen shows
export async function searchProviders(specialtyLabel: string, zip: string): Promise<ProviderResult[]> {
  const taxonomy = SPECIALTIES.find((s) => s.label === specialtyLabel)?.taxonomy;
  if (!taxonomy || !/^\d{5}$/.test(zip)) return [];

  // Collect the pages, stopping early when a page comes back short
  const raw: any[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const results = await fetchPage(taxonomy, zip, page * PAGE_SIZE);
    raw.push(...results);
    if (results.length < PAGE_SIZE) break;
  }

  // The registry's ZIP filter is loose, so the screen keeps only doctors near the searched ZIP code (see FindDoctor).
  // Some doctors appear on more than one page, so each one is kept once.
  const seen = new Set<string>();
  const matches: ProviderResult[] = [];
  for (const result of raw) {
    const npi = String(result.number);
    if (seen.has(npi)) continue;
    seen.add(npi);
    const location = locationOf(result);
    const basic = result.basic || {};
    const primary = (result.taxonomies || []).find((t: any) => t.primary) || (result.taxonomies || [])[0] || {};
    const name = [basic.first_name, basic.middle_name, basic.last_name].filter(Boolean).join(' ');
    const address = [location.address_1, location.city, location.state].filter(Boolean).join(', ');
    matches.push({
      npi,
      name: `${name}${basic.credential ? `, ${basic.credential}` : ''}`,
      specialty: primary.desc || specialtyLabel,
      address,
      zip: String(location.postal_code || '').slice(0, 5),
      phone: location.telephone_number || undefined,
    });
  }
  return matches;
}
