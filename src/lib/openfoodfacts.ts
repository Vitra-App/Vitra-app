// Open Food Facts API client
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
// Free, no API key required.

export type OFFNutriments = {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  fiber_100g?: number;
  sugars_100g?: number;
  sodium_100g?: number; // grams (multiply by 1000 for mg)
  'saturated-fat_100g'?: number;
  cholesterol_100g?: number; // grams
  potassium_100g?: number; // grams
  'vitamin-d_100g'?: number; // grams
  calcium_100g?: number; // grams
  iron_100g?: number; // grams
};

export type OFFProduct = {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: OFFNutriments;
  image_front_small_url?: string;
};

export type MappedFood = {
  name: string;
  brand: string | null;
  barcode: string;
  source: 'openfoodfacts';
  externalId: string;
  servingSize: string;
  servingWeightG: number;
  densityGPerMl: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  saturatedFatG: number | null;
  potassiumMg: number | null;
  vitaminDMcg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
};

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

export async function fetchOpenFoodFactsByBarcode(
  barcode: string,
): Promise<MappedFood | null> {
  const cleaned = barcode.replace(/\D/g, '');
  if (!cleaned) return null;

  const url = `${OFF_BASE}/${encodeURIComponent(cleaned)}.json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Vitra/0.1 (nutrition tracking)' },
    // Cache responses on the server for an hour
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { status?: number; product?: OFFProduct };
  if (data.status !== 1 || !data.product) return null;

  return mapOFFProduct(data.product, cleaned);
}

function mapOFFProduct(p: OFFProduct, barcode: string): MappedFood {
  const n = p.nutriments ?? {};

  // ── Serving size ──────────────────────────────────────────────────────────
  // Open Food Facts provides:
  //   serving_size:     human label e.g. "28 g", "1 cup (240 ml)", "3 biscuits (45g)"
  //   serving_quantity: numeric grams of one serving (most reliable)
  //
  // All nutriment values in the OFF API are per 100g.
  // We scale them to the actual serving weight so the app shows correct numbers.

  // Parse serving_quantity — can be a number or a numeric string
  let servingWeightG = 100; // fallback
  const sq = p.serving_quantity;
  if (sq !== undefined && sq !== null) {
    const parsed = typeof sq === 'number' ? sq : parseFloat(String(sq));
    if (!isNaN(parsed) && parsed > 0) servingWeightG = parsed;
  }

  // Build a clean human-readable serving size label
  const servingSizeLabel =
    p.serving_size && String(p.serving_size).trim().length > 0
      ? String(p.serving_size).trim()
      : `${servingWeightG} g`;

  // Scale factor: from per-100g to per-actual-serving
  const scale = servingWeightG / 100;

  const scalePer100 = (v?: number) =>
    typeof v === 'number' ? Math.round(v * scale * 10) / 10 : null;

  // Sodium/cholesterol/potassium in OFF are in grams per 100g → scale then convert to mg
  const gToMgScaled = (g?: number) =>
    typeof g === 'number' ? Math.round(g * scale * 1000) : null;

  return {
    name: p.product_name?.trim() || `Unknown product (${barcode})`,
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode,
    source: 'openfoodfacts',
    externalId: barcode,
    servingSize: servingSizeLabel,
    servingWeightG,
    densityGPerMl: null,
    calories: Math.round((n['energy-kcal_100g'] ?? 0) * scale),
    proteinG: Math.round((n.proteins_100g ?? 0) * scale * 10) / 10,
    carbsG: Math.round((n.carbohydrates_100g ?? 0) * scale * 10) / 10,
    fatG: Math.round((n.fat_100g ?? 0) * scale * 10) / 10,
    fiberG: scalePer100(n.fiber_100g),
    sugarG: scalePer100(n.sugars_100g),
    sodiumMg: gToMgScaled(n.sodium_100g),
    cholesterolMg: gToMgScaled(n.cholesterol_100g),
    saturatedFatG: scalePer100(n['saturated-fat_100g']),
    potassiumMg: gToMgScaled(n.potassium_100g),
    vitaminDMcg:
      typeof n['vitamin-d_100g'] === 'number'
        ? Math.round(n['vitamin-d_100g']! * scale * 1_000_000) // grams -> mcg, scaled
        : null,
    calciumMg: gToMgScaled(n.calcium_100g),
    ironMg: gToMgScaled(n.iron_100g),
  };
}
