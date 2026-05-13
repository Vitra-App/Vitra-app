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

  // Per-100g values; use 100g as the canonical serving for OFF imports.
  const servingWeightG = 100;
  const servingSize =
    p.serving_size && String(p.serving_size).trim().length > 0
      ? String(p.serving_size)
      : '100 g';

  const gToMg = (g?: number) => (typeof g === 'number' ? g * 1000 : null);

  return {
    name: p.product_name?.trim() || `Unknown product (${barcode})`,
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode,
    source: 'openfoodfacts',
    externalId: barcode,
    servingSize,
    servingWeightG,
    densityGPerMl: null,
    calories: n['energy-kcal_100g'] ?? 0,
    proteinG: n.proteins_100g ?? 0,
    carbsG: n.carbohydrates_100g ?? 0,
    fatG: n.fat_100g ?? 0,
    fiberG: n.fiber_100g ?? null,
    sugarG: n.sugars_100g ?? null,
    sodiumMg: gToMg(n.sodium_100g),
    cholesterolMg: gToMg(n.cholesterol_100g),
    saturatedFatG: n['saturated-fat_100g'] ?? null,
    potassiumMg: gToMg(n.potassium_100g),
    vitaminDMcg:
      typeof n['vitamin-d_100g'] === 'number'
        ? n['vitamin-d_100g']! * 1_000_000 // grams -> mcg
        : null,
    calciumMg: gToMg(n.calcium_100g),
    ironMg: gToMg(n.iron_100g),
  };
}
