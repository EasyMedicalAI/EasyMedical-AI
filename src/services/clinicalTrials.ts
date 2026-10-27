// Clinical trials that are recruiting near a ZIP code, from ClinicalTrials.gov (a public database, no login).
// Only a condition name and a search area are sent. No name, date of birth, or other record details.
import { Location, milesBetween } from '@/services/zipLocation';

export interface TrialSite {
  facility: string;
  city: string;
  state: string;
  miles?: number;
}

export interface Trial {
  nctId: string;
  title: string;
  summary: string;
  phases: string[];
  minimumAge?: string;
  maximumAge?: string;
  sex?: string;
  eligibility: string;
  // The site closest to the searched ZIP code
  nearestSite: TrialSite | null;
  // The condition from your records that found this trial
  matchedCondition: string;
}

const TRIALS_URL = 'https://clinicaltrials.gov/api/v2/studies';
// Only studies with a site within this many miles of the ZIP code are returned
const SEARCH_MILES = 25;
const PAGE_SIZE = 20;

// Trials for each condition, merged. A trial found by more than one condition is shown once, under the first.
// Trials are sorted by distance to the nearest site.
export async function findTrials(conditions: string[], origin: Location): Promise<Trial[]> {
  const results = await Promise.all(conditions.map((condition) => searchCondition(condition, origin)));
  const seen = new Set<string>();
  const trials: Trial[] = [];
  for (const trial of results.flat()) {
    if (seen.has(trial.nctId)) continue;
    seen.add(trial.nctId);
    trials.push(trial);
  }
  return trials.sort((a, b) => (a.nearestSite?.miles ?? Infinity) - (b.nearestSite?.miles ?? Infinity));
}

async function searchCondition(condition: string, origin: Location): Promise<Trial[]> {
  const params = new URLSearchParams({
    'query.cond': condition,
    'filter.overallStatus': 'RECRUITING',
    'filter.geo': `distance(${origin.lat},${origin.lon},${SEARCH_MILES}mi)`,
    pageSize: String(PAGE_SIZE),
  });
  const response = await fetch(`${TRIALS_URL}?${params.toString()}`);
  if (!response.ok) throw new Error('The trial database is not responding right now.');
  const data = await response.json();
  const studies: any[] = data?.studies || [];
  return studies.map((study) => toTrial(study, condition, origin));
}

function toTrial(study: any, condition: string, origin: Location): Trial {
  const protocol = study.protocolSection || {};
  const eligibility = protocol.eligibilityModule || {};
  const locations: any[] = protocol.contactsLocationsModule?.locations || [];
  const sites: TrialSite[] = locations.map((location) => {
    const point = location.geoPoint;
    const miles = point ? milesBetween(origin, { lat: point.lat, lon: point.lon }) : undefined;
    return { facility: location.facility || '', city: location.city || '', state: location.state || '', miles };
  });
  const nearest = sites.reduce<TrialSite | null>((best, site) => {
    if (site.miles === undefined) return best;
    return !best || best.miles === undefined || site.miles < best.miles ? site : best;
  }, null);

  return {
    nctId: protocol.identificationModule?.nctId || '',
    title: protocol.identificationModule?.briefTitle || 'Untitled study',
    summary: protocol.descriptionModule?.briefSummary || '',
    phases: (protocol.designModule?.phases || []).map(phaseLabel),
    minimumAge: eligibility.minimumAge,
    maximumAge: eligibility.maximumAge,
    sex: eligibility.sex,
    // The criteria arrive with markdown escapes, such as "\>", so the backslashes are removed
    eligibility: (eligibility.eligibilityCriteria || '').replace(/\\([<>])/g, '$1'),
    nearestSite: nearest,
    matchedCondition: condition,
  };
}

// "PHASE2" → "Phase 2", "NA" → "Not applicable"
function phaseLabel(phase: string): string {
  if (phase === 'NA') return 'Not applicable';
  if (phase === 'EARLY_PHASE1') return 'Early phase 1';
  return `Phase ${phase.replace('PHASE', '')}`;
}
