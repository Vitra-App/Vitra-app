// Convert a user-entered (amount, unit) into grams, given a food's
// `servingWeightG` (the gram weight of one nominal serving).
//
// Volume units assume water-like density (1 mL ≈ 1 g). This is approximate
// for many foods (milk, juice, broth) but inaccurate for dense or airy
// ingredients. The user can always switch to a mass unit for accuracy.

export type UnitId =
  | 'serving'
  | 'g'
  | 'kg'
  | 'oz'
  | 'lb'
  | 'ml'
  | 'l'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'floz';

export type UnitDef = {
  id: UnitId;
  label: string;
  kind: 'count' | 'mass' | 'volume';
};

export const UNITS: UnitDef[] = [
  { id: 'serving', label: 'serving', kind: 'count' },
  { id: 'g', label: 'g', kind: 'mass' },
  { id: 'kg', label: 'kg', kind: 'mass' },
  { id: 'oz', label: 'oz', kind: 'mass' },
  { id: 'lb', label: 'lb', kind: 'mass' },
  { id: 'ml', label: 'mL', kind: 'volume' },
  { id: 'l', label: 'L', kind: 'volume' },
  { id: 'cup', label: 'cup', kind: 'volume' },
  { id: 'tbsp', label: 'tbsp', kind: 'volume' },
  { id: 'tsp', label: 'tsp', kind: 'volume' },
  { id: 'floz', label: 'fl oz', kind: 'volume' },
];

// grams per 1 unit (volume units use water-density approximation)
const GRAMS_PER_UNIT: Record<Exclude<UnitId, 'serving'>, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
  ml: 1,
  l: 1000,
  cup: 240,        // US legal cup
  tbsp: 14.7867648,
  tsp: 4.92892159,
  floz: 29.5735296,
};

export function amountToGrams(
  amount: number,
  unit: UnitId,
  servingWeightG: number,
  densityGPerMl: number | null = null,
): number {
  if (!isFinite(amount) || amount <= 0) return 0;
  if (unit === 'serving') return amount * servingWeightG;
  const ml = amountToMl(amount, unit);
  if (ml !== null) {
    // Volume unit — use density if known, else assume water (1 g/mL).
    return ml * (densityGPerMl ?? 1);
  }
  return amount * GRAMS_PER_UNIT[unit];
}

function amountToMl(amount: number, unit: UnitId): number | null {
  switch (unit) {
    case 'ml': return amount;
    case 'l': return amount * 1000;
    case 'cup': return amount * 240;
    case 'tbsp': return amount * 14.7867648;
    case 'tsp': return amount * 4.92892159;
    case 'floz': return amount * 29.5735296;
    default: return null;
  }
}

export function gramsToServings(grams: number, servingWeightG: number): number {
  if (servingWeightG <= 0) return 0;
  return grams / servingWeightG;
}

// Convenience: turn (amount, unit) into a serving multiplier.
export function amountToServings(
  amount: number,
  unit: UnitId,
  servingWeightG: number,
  densityGPerMl: number | null = null,
): number {
  return gramsToServings(amountToGrams(amount, unit, servingWeightG, densityGPerMl), servingWeightG);
}
