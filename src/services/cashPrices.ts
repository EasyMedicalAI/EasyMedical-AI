// Cash prices from Cost Plus Drugs, a mail-order pharmacy, for one medication. Prices don't depend on the ZIP code.
// The backend asks Cost Plus for the medication's name and strength, and only the matching product is kept.
// Prices are calculated for a standard 30-tablet fill before shipping, which Cost Plus doesn't include in these results.
import type { MedicineMatch } from './medicineLookup';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://easymedical-backend-new-production.up.railway.app';
// The fill size that prices are calculated for
export const STANDARD_FILL = 30;

export interface CashPrice {
  pharmacy: string;
  // The estimated total for a standard fill, before shipping
  price: number;
  quantity: string;
  asOf: string;
  // The product page on Cost Plus Drugs
  url?: string;
}

interface CostPlusResult {
  name: string;
  form: string;
  strength: string;
  unit: string;
  pricePerUnit?: number;
  dispensingFee?: number;
  url?: string;
}

// The strength in the product name, such as "20 MG" → "20mg"
function strengthOf(name: string): string | null {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(MG|MCG|G|ML)\b/i);
  return match ? `${match[1]}${match[2].toLowerCase()}` : null;
}

// Cost Plus prices for the product, or an empty list when Cost Plus doesn't carry it
export async function cashPrices(product: MedicineMatch, genericName: string | null): Promise<CashPrice[]> {
  const strength = strengthOf(product.name);
  const term = genericName || product.name.split(' ')[0];
  if (!strength || !term) return [];

  const params = new URLSearchParams({ rxcui: product.rxcui, term, strength });
  const response = await fetch(`${BACKEND_URL}/api/prices/costplus?${params.toString()}`);
  if (!response.ok) throw new Error('Cost Plus prices are not responding right now.');
  const data = await response.json();
  const results: CostPlusResult[] = data?.results || [];
  const asOf = new Date().toLocaleDateString();

  return results
    .filter((result) => typeof result.pricePerUnit === 'number' && typeof result.dispensingFee === 'number')
    .map((result) => ({
      pharmacy: 'Cost Plus Drugs',
      price: STANDARD_FILL * (result.pricePerUnit as number) + (result.dispensingFee as number),
      quantity: `${STANDARD_FILL} ${result.form.toLowerCase()}s, before shipping`,
      asOf,
      url: result.url,
    }));
}
