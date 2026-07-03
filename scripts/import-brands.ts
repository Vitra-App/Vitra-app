/**
* USDA Branded / Restaurant food importer
* ----------------------------------------
* Pulls branded & restaurant products from USDA FoodData Central's "Branded"
* dataset and upserts them into your Food table (with the brand field populated).
*
* The Branded dataset contains ~1.9M items — packaged grocery brands (Chobani,
* Kellogg's, Lay's…) AND many restaurant chains (Chick-fil-A, McDonald's,
* Subway, Chipotle…). We import by BRAND NAME so you only pull the ones you want.
*
* Usage:
*   USDA_API_KEY=your_key npx tsx scripts/import-brands.ts
*   USDA_API_KEY=your_key npx tsx scripts/import-brands.ts "Chick-fil-A" "Chipotle"
*
*   # Against the PRODUCTION database (Railway):
*   DATABASE_URL="<DATABASE_PUBLIC_URL>" USDA_API_KEY=your_key npx tsx scripts/import-brands.ts
*
* Get a free USDA key (1,000 req/hr) at:
*   https://fdc.nal.usda.gov/api-key-signup.html
*/

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_KEY = (process.env.USDA_API_KEY && process.env.USDA_API_KEY.trim()) || 'DEMO_KEY';
const BASE = 'https://api.nal.usda.gov/fdc/v1';

// How many pages (200 items each) to pull per brand. 5 pages = up to 1,000 items/brand.
const PAGES_PER_BRAND = Number(process.env.PAGES_PER_BRAND ?? 5);

// ── Default brand / restaurant list ─────────────────────────────────────────
// Edit this list, or pass names as CLI args to override it.
const DEFAULT_BRANDS = [
 // Fast-food / restaurant chains
 'Chick-fil-A', "McDonald's", 'Burger King', 'Wendy\'s', 'Taco Bell',
 'Chipotle', 'Subway', 'Panera', 'Domino\'s', 'Pizza Hut', 'KFC',
 'Popeyes', 'Dunkin', 'Starbucks', 'Panda Express', 'Five Guys',
 'Shake Shack', 'Sonic', 'Arby\'s', 'Jack in the Box', 'Wingstop',
 // Packaged grocery brands
 'Chobani', 'Fairlife', 'Quest', 'Premier Protein', 'Kellogg\'s',
 'General Mills', 'Nature Valley', 'Clif', 'Kind', 'Lay\'s',
 'Doritos', 'Ben & Jerry\'s', 'Halo Top', 'Oikos', 'Bell & Evans',
 'Perdue', 'Tyson', 'Oscar Mayer', 'Kraft', 'Campbell\'s',
];

const NUTRIENT_NUMBERS = {
 calories: '208', protein: '203', fat: '204', carbs: '205', fiber: '291',
 sugar: '269', sodium: '307', cholesterol: '601', saturatedFat: '606',
 potassium: '306', vitaminD: '328', calcium: '301', iron: '303',
} as const;

interface UsdaNutrient { nutrientNumber?: string; value?: number }
interface UsdaFood {
 fdcId: number;
 description: string;
 brandOwner?: string;
 brandName?: string;
 servingSize?: number;
 servingSizeUnit?: string;
 householdServingFullText?: string;
 foodNutrients?: UsdaNutrient[];
}

function getNutrient(food: UsdaFood, num: string): number | null {
 const n = food.foodNutrients?.find((x) => x.nutrientNumber === num);
 return typeof n?.value === 'number' ? n.value : null;
}

function mapFood(f: UsdaFood, query: string) {
 const servingG =
   f.servingSize && f.servingSizeUnit?.toLowerCase() === 'g' ? f.servingSize : 100;
 const servingSize =
   f.householdServingFullText ||
   (f.servingSize ? `${f.servingSize} ${f.servingSizeUnit ?? 'g'}` : '100 g');
 const scale = servingG / 100;
 const get = (num: string) => {
   const v = getNutrient(f, num);
   return typeof v === 'number' ? v * scale : null;
 };

 const calories = get(NUTRIENT_NUMBERS.calories) ?? 0;
 const proteinG = get(NUTRIENT_NUMBERS.protein) ?? 0;
 const carbsG = get(NUTRIENT_NUMBERS.carbs) ?? 0;
 const fatG = get(NUTRIENT_NUMBERS.fat) ?? 0;

 // Skip empty entries
 if (calories === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) return null;

 // Match the query against BOTH brandName and brandOwner. USDA stores the
 // recognizable brand in brandName ("CHICK-FIL-A") and the manufacturer in
 // brandOwner ("T. Marzetti Company"). Keep the one that matches the query.
  const norm = (s: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const q = norm(query).slice(0, 6);
 const owner = f.brandOwner ?? '';
 const bname = f.brandName ?? '';
 const ownerMatch = norm(owner).includes(q);
 const nameMatch = norm(bname).includes(q);
 if (!ownerMatch && !nameMatch) return null; // not actually this brand

 // Prefer the human-friendly brand label
 const brand = nameMatch ? (bname || owner) : (owner || bname);

 return {
   name: f.description.trim().replace(/\s+/g, ' '),
   brand: brand ? brand.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim() : null,
   source: 'usda',
   externalId: String(f.fdcId),
   servingSize,
   servingWeightG: servingG,
   calories, proteinG, carbsG, fatG,
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBrandPage(brand: string, pageNumber: number): Promise<UsdaFood[]> {
 const url =
   `${BASE}/foods/search?query=${encodeURIComponent(brand)}` +
   `&dataType=Branded&pageSize=200&pageNumber=${pageNumber}` +
   `&api_key=${encodeURIComponent(API_KEY)}`;
 const res = await fetch(url);
 if (!res.ok) {
   console.warn(`   ⚠ HTTP ${res.status} for "${brand}" page ${pageNumber}`);
   return [];
 }
 const data = (await res.json()) as { foods?: UsdaFood[] };
 return data.foods ?? [];
}

async function importBrand(brand: string): Promise<number> {
 process.stdout.write(`\n🏷  ${brand}: `);
 let inserted = 0;

 for (let page = 1; page <= PAGES_PER_BRAND; page++) {
    const foods = await fetchBrandPage(brand, page);
    if (foods.length === 0) break;
    if (process.env.DEBUG) console.log(`\n   [debug] page ${page}: fetched ${foods.length} foods`);

   for (const food of foods) {
     const rec = mapFood(food, brand);
     if (!rec) continue;

     try {
       await prisma.food.upsert({
         where: { source_externalId: { source: rec.source, externalId: rec.externalId } },
         update: {
           name: rec.name, brand: rec.brand, calories: rec.calories,
           proteinG: rec.proteinG, carbsG: rec.carbsG, fatG: rec.fatG,
           fiberG: rec.fiberG, sugarG: rec.sugarG, sodiumMg: rec.sodiumMg,
           cholesterolMg: rec.cholesterolMg, saturatedFatG: rec.saturatedFatG,
           potassiumMg: rec.potassiumMg, vitaminDMcg: rec.vitaminDMcg,
           calciumMg: rec.calciumMg, ironMg: rec.ironMg,
         },
         create: rec,
       });
        inserted++;
      } catch (e: any) {
        console.warn(`\n   ⚠ upsert failed for "${rec.name}": ${e?.message ?? e}`);
      }
   }

   process.stdout.write(`${inserted} `);
   if (foods.length < 200) break; // last page
   await sleep(API_KEY === 'DEMO_KEY' ? 2500 : 120);
 }

 console.log(`✓ (${inserted} items)`);
 return inserted;
}

async function main() {
 const brands = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_BRANDS;

 console.log(`\n🍔 USDA Branded / Restaurant importer`);
 console.log(`   API key: ${API_KEY === 'DEMO_KEY' ? 'DEMO_KEY (very rate-limited!)' : 'custom key ✓'}`);
 console.log(`   Brands to import: ${brands.length}`);
 console.log(`   Pages per brand: ${PAGES_PER_BRAND} (up to ${PAGES_PER_BRAND * 200} items each)`);

 if (API_KEY === 'DEMO_KEY') {
   console.log(`\n   ⚠ DEMO_KEY allows only ~30 requests/hour — get a free key first:`);
   console.log(`     https://fdc.nal.usda.gov/api-key-signup.html\n`);
 }

 const t0 = Date.now();
 let total = 0;
 for (const brand of brands) {
   total += await importBrand(brand);
 }

 const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
 console.log(`\n✅  Done in ${elapsed}s — ${total} branded foods imported/updated.\n`);
}

main()
 .catch((e) => { console.error(e); process.exit(1); })
 .finally(() => prisma.$disconnect());
