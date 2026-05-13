// USDA FoodData Central API client
// Docs: https://fdc.nal.usda.gov/api-guide.html
// Requires free API key from https://fdc.nal.usda.gov/api-key-signup.html
// Set USDA_API_KEY in .env.local

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// Mapping of USDA nutrient numbers (canonical IDs) -> our fields.
// See https://fdc.nal.usda.gov/portal-data/external/dataDictionary
const NUTRIENT_NUMBERS = {
  calories: '208', // Energy (kcal)
  protein: '203',
  fat: '204',
  carbs: '205',
  fiber: '291',
  sugar: '269',
  sodium: '307', // mg
  cholesterol: '601', // mg
  saturatedFat: '606', // g
  potassium: '306', // mg
  vitaminD: '328', // mcg
  calcium: '301', // mg
  iron: '303', // mg
} as const;

type USDANutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
};

type USDAFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: USDANutrient[];
};

type USDASearchResponse = {
  foods?: USDAFood[];
  totalHits?: number;
};

export type USDASearchResult = {
  externalId: string; // fdcId as string
  source: 'usda';
  name: string;
  brand: string | null;
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

export function hasUsdaKey(): boolean {
  return Boolean(process.env.USDA_API_KEY?.trim());
}

export async function searchUsdaFoods(query: string, pageSize = 15): Promise<USDASearchResult[]> {
  const key = process.env.USDA_API_KEY?.trim();
  if (!key) return [];
  if (!query.trim()) return [];

  const url = `${USDA_BASE}/foods/search?query=${encodeURIComponent(
    query,
  )}&pageSize=${pageSize}&dataType=Foundation,SR%20Legacy,Branded&api_key=${encodeURIComponent(
    key,
  )}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = (await res.json()) as USDASearchResponse;
  return (data.foods ?? []).map(mapUsdaFood);
}

function getNutrient(food: USDAFood, num: string): number | null {
  const n = food.foodNutrients?.find((x) => x.nutrientNumber === num);
  return typeof n?.value === 'number' ? n.value : null;
}

function mapUsdaFood(f: USDAFood): USDASearchResult {
  const servingG =
    f.servingSize && f.servingSizeUnit?.toLowerCase() === 'g'
      ? f.servingSize
      : 100;

  const servingSize =
    f.householdServingFullText ||
    (f.servingSize ? `${f.servingSize} ${f.servingSizeUnit ?? 'g'}` : '100 g');

  // USDA values are per 100g for non-branded; for branded with servingSize they
  // are also reported per 100g. We standardize on per-serving-as-displayed below
  // by scaling to servingG / 100.
  const scale = servingG / 100;

  const get = (num: string) => {
    const v = getNutrient(f, num);
    return typeof v === 'number' ? v * scale : null;
  };

  return {
    externalId: String(f.fdcId),
    source: 'usda',
    name: f.description,
    brand: f.brandOwner || f.brandName || null,
    servingSize,
    servingWeightG: servingG,
    densityGPerMl: null,
    calories: get(NUTRIENT_NUMBERS.calories) ?? 0,
    proteinG: get(NUTRIENT_NUMBERS.protein) ?? 0,
    carbsG: get(NUTRIENT_NUMBERS.carbs) ?? 0,
    fatG: get(NUTRIENT_NUMBERS.fat) ?? 0,
    fiberG: get(NUTRIENT_NUMBERS.fiber),
    sugarG: get(NUTRIENT_NUMBERS.sugar),
    sodiumMg: get(NUTRIENT_NUMBERS.sodium),
    cholesterolMg: get(NUTRIENT_NUMBERS.cholesterol),
    saturatedFatG: get(NUTRIENT_NUMBERS.saturatedFat),
    potassiumMg: get(NUTRIENT_NUMBERS.potassium),
    vitaminDMcg: get(NUTRIENT_NUMBERS.vitaminD),
    calciumMg: get(NUTRIENT_NUMBERS.calcium),
    ironMg: get(NUTRIENT_NUMBERS.iron),
  };
}
