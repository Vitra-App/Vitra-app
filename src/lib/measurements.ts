// Unit conversions for body measurements. DB always stores cm + kg;
// these helpers convert to/from imperial for display.

export type UnitSystem = 'imperial' | 'metric';

const STORAGE_KEY = 'vitra.unitSystem';

// Default to imperial (US) — user can toggle.
export function getDefaultUnitSystem(): UnitSystem {
  if (typeof window === 'undefined') return 'imperial';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'metric' || stored === 'imperial') return stored;
  return 'imperial';
}

export function saveUnitSystem(u: UnitSystem) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, u);
}

// --- Conversions -----------------------------------------------------------
const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / CM_PER_IN;
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn - ft * 12;
  return { ft, inches };
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_IN;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}
