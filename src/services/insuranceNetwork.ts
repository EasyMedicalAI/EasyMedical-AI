// Network status for find a doctor. A doctor is "in network" only when the insurer's own directory lists them.
// No insurer directory is connected yet, so every doctor is "unknown" for now.
// Connecting an insurer means adding its directory lookup here and returning "in" or "not-listed" where it has data.
import type { ProviderResult } from './providerSearch';

export type NetworkStatus = 'in' | 'not-listed' | 'unknown';

// Whether we have a directory for this plan
export function hasDirectory(_plan: string): boolean {
  return false;
}

// The plan is unused until a directory is connected
export async function networkStatuses(_plan: string, providers: ProviderResult[]): Promise<Record<string, NetworkStatus>> {
  const statuses: Record<string, NetworkStatus> = {};
  for (const provider of providers) {
    statuses[provider.npi] = 'unknown';
  }
  return statuses;
}
