// Cash prices near a ZIP code for one generic product.
// No price source is connected yet, so every lookup reports that. When a source is approved, its lookup goes here.
// Only the product name and ZIP code are sent to a price source.

export interface CashPrice {
  pharmacy: string;
  price: number;
  quantity: string;
  asOf: string;
}

export type PriceLookup = { status: 'not-connected' } | { status: 'ok'; prices: CashPrice[] };

export async function cashPrices(productName: string, zip: string): Promise<PriceLookup> {
  if (!productName.trim() || !/^\d{5}$/.test(zip)) return { status: 'ok', prices: [] };
  return { status: 'not-connected' };
}
