// Locations of ZIP codes, so search results can be sorted by distance. Only ZIP codes are looked up.
export interface Location {
  lat: number;
  lon: number;
}

const cache = new Map<string, Location | null>();

// The centre of a ZIP code, or null if it can't be found
export async function zipLocation(zip: string): Promise<Location | null> {
  if (cache.has(zip)) return cache.get(zip) ?? null;
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!response.ok) {
      cache.set(zip, null);
      return null;
    }
    const data = await response.json();
    const place = data.places?.[0];
    const location = place ? { lat: parseFloat(place.latitude), lon: parseFloat(place.longitude) } : null;
    cache.set(zip, location);
    return location;
  } catch {
    // Network problems aren't remembered, so a later search can try again
    return null;
  }
}

// Straight-line distance in miles
export function milesBetween(a: Location, b: Location): number {
  const earthRadiusMiles = 3958.8;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}
