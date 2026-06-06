/**
 * USDA FoodData Central importer
 * Fetches Foundation Foods + SR Legacy foods and upserts them into the Prisma database.
 *
 * Usage:
 *   npx tsx scripts/import-usda.ts
 *
 * Optionally set env var USDA_API_KEY for higher rate limits (free at fdc.nal.usda.gov).
 * Without a key it uses DEMO_KEY (30 req/hr — enough for Foundation Foods only).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_KEY = (process.env.USDA_API_KEY && process.env.USDA_API_KEY.trim()) || 'DEMO_KEY';
const BASE    = 'https://api.nal.usda.gov/fdc/v1';

// ── Nutrient number → field mapping ──────────────────────────────────────────
const NUTRIENT_MAP: Record<string, string> = {
  '208': 'calories',
  '203': 'proteinG',
  '204': 'fatG',
  '205': 'carbsG',
  '291': 'fiberG',
  '269': 'sugarG',
  '307': 'sodiumMg',
  '601': 'cholesterolMg',
  '606': 'saturatedFatG',
  '306': 'potassiumMg',
  '328': 'vitaminDMcg',
  '301': 'calciumMg',
  '303': 'ironMg',
};

interface UsdaFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  foodNutrients: Array<{ number: string; amount: number }>;
}

interface FoodRecord {
  name: string;
  source: string;
  externalId: string;
  servingSize: string;
  servingWeightG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  cholesterolMg?: number;
  saturatedFatG?: number;
  potassiumMg?: number;
  vitaminDMcg?: number;
  calciumMg?: number;
  ironMg?: number;
}

function nutrientVal(food: UsdaFood, num: string): number | undefined {
  const n = food.foodNutrients.find(x => x.number === num);
  return n ? n.amount : undefined;
}

function usdaFoodToRecord(food: UsdaFood): FoodRecord | null {
  const calories = nutrientVal(food, '208') ?? 0;
  const proteinG = nutrientVal(food, '203') ?? 0;
  const carbsG   = nutrientVal(food, '205') ?? 0;
  const fatG     = nutrientVal(food, '204') ?? 0;

  // Skip foods with no meaningful data
  if (calories === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) return null;

  // Capitalise name nicely
  const name = food.description
    .split(',')[0]               // "Chicken, raw" → "Chicken"
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());

  return {
    name:          food.description.trim(),
    source:        'usda',
    externalId:    String(food.fdcId),
    servingSize:   '100g',
    servingWeightG: 100,
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG:        nutrientVal(food, '291'),
    sugarG:        nutrientVal(food, '269'),
    sodiumMg:      nutrientVal(food, '307'),
    cholesterolMg: nutrientVal(food, '601'),
    saturatedFatG: nutrientVal(food, '606'),
    potassiumMg:   nutrientVal(food, '306'),
    vitaminDMcg:   nutrientVal(food, '328'),
    calciumMg:     nutrientVal(food, '301'),
    ironMg:        nutrientVal(food, '303'),
  };
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(dataType: string, pageNumber: number, pageSize = 200): Promise<UsdaFood[]> {
  const url = `${BASE}/foods/list?dataType=${encodeURIComponent(dataType)}&pageSize=${pageSize}&pageNumber=${pageNumber}&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ⚠ HTTP ${res.status} for page ${pageNumber} (${dataType})`);
    return [];
  }
  return res.json();
}

async function importDataType(dataType: string, label: string) {
  console.log(`\n── ${label} ──`);

  let page = 1;
  let total = 0;
  let inserted = 0;

  while (true) {
    process.stdout.write(`  Fetching page ${page}…`);
    const foods = await fetchPage(dataType, page);

    if (foods.length === 0) {
      console.log(' done (no more results)');
      break;
    }

    total += foods.length;
    process.stdout.write(` ${foods.length} foods → processing…`);

    for (const food of foods) {
      const record = usdaFoodToRecord(food);
      if (!record) continue;

      try {
        await prisma.food.upsert({
          where: {
            source_externalId: {
              source:     record.source,
              externalId: record.externalId,
            },
          },
          update: {
            name:          record.name,
            calories:      record.calories,
            proteinG:      record.proteinG,
            carbsG:        record.carbsG,
            fatG:          record.fatG,
            fiberG:        record.fiberG,
            sugarG:        record.sugarG,
            sodiumMg:      record.sodiumMg,
            cholesterolMg: record.cholesterolMg,
            saturatedFatG: record.saturatedFatG,
            potassiumMg:   record.potassiumMg,
            vitaminDMcg:   record.vitaminDMcg,
            calciumMg:     record.calciumMg,
            ironMg:        record.ironMg,
          },
          create: record,
        });
        inserted++;
      } catch (e: any) {
        console.warn(`  ⚠ Skipped "${record.name}": ${e.message}`);
      }
    }

    console.log(` ✓ (running total: ${inserted})`);

    page++;

    // Respect rate limits: 1.5 s between pages (safe for DEMO_KEY at ~30 req/hr)
    // With a registered API key you can reduce this to 50ms
    const delay = API_KEY === 'DEMO_KEY' ? 2500 : 50;
    if (foods.length === 200) await sleep(delay);
    else break;
  }

  console.log(`  ${label}: ${inserted} / ${total} foods upserted`);
  return inserted;
}

async function main() {
  console.log(`\n🥦 USDA FoodData Central importer`);
  console.log(`   API key: ${API_KEY === 'DEMO_KEY' ? 'DEMO_KEY (rate-limited)' : 'custom key'}`);
  console.log(`   Tip: set USDA_API_KEY env var for a free registered key (1,000 req/hr)\n`);

  const t0 = Date.now();

  // Foundation Foods — ~600 highly curated foods, full nutrient profiles
  const n1 = await importDataType('Foundation', 'Foundation Foods (~600 foods, gold standard)');

  // SR Legacy — ~8,800 foods from USDA Standard Reference
  // With DEMO_KEY this will hit rate limits after ~30 pages (6,000 foods)
  // Re-run with USDA_API_KEY set to get all ~8,800
  const n2 = await importDataType('SR Legacy', 'SR Legacy (~8,800 foods, Standard Reference)');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n✅  Done in ${elapsed}s — ${n1 + n2} foods total imported.`);

  if (API_KEY === 'DEMO_KEY') {
    console.log(`\n📌  To import all SR Legacy foods without rate limits:`);
    console.log(`    1. Get a free key at https://fdc.nal.usda.gov/api-guide.html`);
    console.log(`    2. Run: USDA_API_KEY=your_key npx tsx scripts/import-usda.ts`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
