/**
 * Food-grounding: cross-checks AI-estimated meal items against our real nutrition
 * database (USDA Foundation/SR Legacy + 8,000+ branded products) and replaces the
 * AI's memorized/estimated calorie values with real per-gram database values
 * whenever a confident match is found.
 *
 * Vision models are good at judging *portion size* (the container, relative
 * volume, etc.) but unreliable at *calorie density* (they rely on approximate
 * memorized nutrition facts). Grounding combines the AI's portion judgement
 * with real USDA-sourced calorie/macro density, which measurably improves
 * accuracy without needing a custom-trained model or labeled photo dataset.
 */

import { prisma } from '@/lib/prisma';
import type { MealPhotoAnalysis } from '@/lib/ai-service';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'with', 'of', 'plain', 'fresh', 'raw', 'cooked',
  'grilled', 'baked', 'fried', 'roasted', 'steamed', 'sliced', 'diced', 'chopped',
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Extract a gram weight from a serving-size string like "180g", "1 cup (150g)", "350ml". */
export function parseGrams(servingSize: string): number | null {
  const gramMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gramMatch) return parseFloat(gramMatch[1]);
  const mlMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) return parseFloat(mlMatch[1]); // assume density ~1.0 g/ml as a fallback
  return null;
}

/** Title-case a noisy all-caps/DB-style product name, e.g. "BREADED CHICKEN PATTIES" -> "Breaded Chicken Patties". */
function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Build a clean display name for a grounded item, avoiding a duplicated brand
 * prefix when the matched database row's own name already starts with it
 * (common for USDA branded imports, e.g. "BELL & EVANS, BREADED CHICKEN PATTIES").
 */
function groundedDisplayName(match: Candidate): string {
  const cleanedName = match.name.replace(/^,?\s*/, '').replace(/,/g, '').trim();
  if (!match.brand) return titleCase(cleanedName);
  const brandLower = match.brand.toLowerCase();
  const alreadyPrefixed = cleanedName.toLowerCase().startsWith(brandLower);
  const combined = alreadyPrefixed ? cleanedName : `${match.brand} ${cleanedName}`;
  return titleCase(combined);
}

interface Candidate {
  name: string;
  brand: string | null;
  servingWeightG: number;
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
}

function scoreMatch(itemWords: string[], candidateName: string, itemName: string, candidateBrand: string | null): number {
  const candWords = normalizeWords(candidateName);
  if (candWords.length === 0 || itemWords.length === 0) return 0;
  const candSet = new Set(candWords);
  const itemSet = new Set(itemWords);
  let overlap = 0;
  for (const w of itemSet) if (candSet.has(w)) overlap++;
  // Reward matches where most of the item's words are present in the candidate,
  // and penalize candidates that are much longer/more specific than the item name.
  const recall = overlap / itemSet.size;
  const lengthPenalty = Math.min(1, itemSet.size / Math.max(candSet.size, 1));
  let score = recall * (0.7 + 0.3 * lengthPenalty);
  // Strong bonus when the candidate's own brand name appears verbatim in the AI's
  // item name (e.g. "Bell & Evans" in both) -- a very high-confidence signal that
  // the AI is describing this exact branded product, even if the rest of the name
  // overlap is partial (e.g. AI said "Chicken Patty", DB has "Breaded Chicken Patties").
  if (candidateBrand) {
    const brandWords = normalizeWords(candidateBrand);
    if (brandWords.length > 0) {
      const brandInItem = brandWords.every((w) => itemName.toLowerCase().includes(w));
      if (brandInItem) score = Math.min(1, score + 0.3);
    }
  }
  return score;
}

/**
 * Extract candidate 2-3 word consecutive phrases from free text that could be a
 * brand/product name (e.g. "Bell & Evans" out of "2 bell & evans chicken
 * patties"). Deliberately does NOT return single words -- a lone generic word
 * like "chicken" or "meatballs" is never treated as a brand signal, since that
 * caused real mismatches (see findBestMatch's comment below for the reproduced
 * failures this fixes).
 */
export function extractBrandPhrases(text: string): string[] {
  const rawWords = text.split(/\s+/).filter(Boolean);
  const phrases = new Set<string>();
  for (let len = Math.min(3, rawWords.length); len >= 2; len--) {
    for (let i = 0; i + len <= rawWords.length; i++) {
      const phrase = rawWords.slice(i, i + len).join(' ').replace(/[^\p{L}\p{N}&'\s-]/gu, '').trim();
      if (phrase.length >= 4) phrases.add(phrase);
    }
  }
  return Array.from(phrases);
}

/**
 * Find a confident database match for an AI-identified item name, used to
 * replace the AI's memorized/estimated nutrition values with real ones.
 *
 * IMPORTANT: This is intentionally a SINGLE strategy -- a targeted brand-phrase
 * lookup against the `brand` column -- with NO generic word-overlap fallback.
 * An earlier version had a "Phase 2" fallback that searched the whole database
 * by the rarest word in the item name when no brand phrase matched. That was
 * removed after two reproduced failures:
 *   1. Many rows have a specific brand/restaurant baked into the `name` string
 *      but a NULL `brand` column (e.g. "HIP CHICK FARMS, BAKED CHICKEN
 *      MEATBALLS" has brand=NULL), so filtering by "brand IS NULL" does not
 *      reliably exclude branded items.
 *   2. A plain single-word item name like "Spaghetti" or "Meatball" would
 *      match thousands of unrelated branded rows purely on substring overlap
 *      (e.g. grounding to "Campbell's Spaghetti O's" or "Hip Chick Farms
 *      Chicken Meatballs"), with no real signal the user meant that specific
 *      commercial product.
 * For anything without an identifiable named brand, the AI's own estimate
 * (low-temperature, strongly prompted, and passed through
 * stripUnmentionedBrandNames) is trusted as-is instead.
 */
async function findBestMatch(itemName: string): Promise<Candidate | null> {
  const words = normalizeWords(itemName);
  if (words.length === 0) return null;

  const selectFields = {
    name: true, brand: true, servingWeightG: true, calories: true,
    proteinG: true, carbsG: true, fatG: true, fiberG: true, sugarG: true,
    sodiumMg: true, cholesterolMg: true, saturatedFatG: true, potassiumMg: true,
    vitaminDMcg: true, calciumMg: true, ironMg: true,
  } as const;

  const brandPhraseCandidates = extractBrandPhrases(itemName);
  if (brandPhraseCandidates.length === 0) return null;

  const candidates = await prisma.food.findMany({
    where: {
      NOT: { source: 'ai' },
      OR: brandPhraseCandidates.map((p) => ({
        brand: { contains: p, mode: 'insensitive' as const },
      })),
    },
    select: selectFields,
    take: 40,
  });

  let best: Candidate | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (!c.servingWeightG || c.servingWeightG <= 0) continue;
    const score = scoreMatch(words, c.name, itemName, c.brand);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  // A brand-phrase hit is already a very high-confidence signal (the user/AI
  // named an actual product), so accept it on a lower bar than a truly generic
  // fuzzy match would ever warrant.
  return bestScore >= 0.5 ? best : null;
}

/**
 * Deterministic safety net against brand hallucination: even with explicit
 * prompt instructions, the model sometimes spontaneously names a specific
 * commercial product for a plain home-style description (e.g. inventing
 * "Campbell's Spaghetti O's" for a plain "bowl of spaghetti" the user never
 * associated with any brand). Prompt engineering alone did not reliably stop
 * this, so this strips any brand name from an item that:
 *   1. matches a REAL brand in our own database (so we don't mangle a
 *      legitimate, correctly-identified generic name), AND
 *   2. does NOT appear anywhere in the user's original description/text --
 *      i.e. the user truly never mentioned it.
 * Legitimately brand-matched items (via groundAnalysisInDatabase's own
 * targeted lookup, or the route's findReferenceFoods reference injection)
 * are unaffected, since in those cases the brand genuinely was named by the
 * user and is expected to appear in the source text.
 */
export async function stripUnmentionedBrandNames(
  analysis: MealPhotoAnalysis,
  originalText: string,
): Promise<MealPhotoAnalysis> {
  if (!analysis.items || analysis.items.length === 0) return analysis;
  const lowerOriginal = originalText.toLowerCase();

  const candidateBrands = await prisma.food.findMany({
    where: { NOT: { source: 'ai' }, brand: { not: null } },
    select: { brand: true },
    distinct: ['brand'],
    take: 500,
  });

  const cleanedItems = analysis.items.map((item) => {
    // Cheap heuristic to skip plain names entirely: only bother checking names
    // that look like they might contain a brand (possessive "'s", a comma-
    // separated product listing, or 2+ consecutive capitalized words that
    // could be a proper noun/company name).
    const looksBranded =
      /[A-Za-z]{2,}'s\b/.test(item.name) ||
      item.name.includes(',') ||
      /\b([A-Z][a-zA-Z]*\s){2,}/.test(item.name);
    if (!looksBranded) return item;

    let strippedName = item.name;
    for (const { brand } of candidateBrands) {
      if (!brand) continue;
      const brandLower = brand.toLowerCase();
      if (brandLower.length < 3) continue;
      if (!strippedName.toLowerCase().includes(brandLower)) continue;
      // The item name contains a real brand -- only strip it if the user's
      // own original text never mentioned that brand at all.
      if (lowerOriginal.includes(brandLower)) continue;

      const re = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
      strippedName = strippedName.replace(re, '').replace(/^[\s,]+|[\s,]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    if (strippedName.length === 0 || strippedName === item.name) return item;
    return { ...item, name: strippedName };
  });

  return { ...analysis, items: cleanedItems };
}

export async function groundAnalysisInDatabase(analysis: MealPhotoAnalysis): Promise<MealPhotoAnalysis> {
  if (!analysis.items || analysis.items.length === 0) return analysis;

  const groundedItems = await Promise.all(
    analysis.items.map(async (item) => {
      const match = await findBestMatch(item.name);
      if (!match) return item;

      // Prefer the AI's own parsed gram estimate for the portion; if it couldn't be
      // parsed from the free-text serving size (e.g. "1 patty", "a bun"), fall back to
      // assuming the AI's per-unit portion matches the database product's own serving
      // size 1:1 rather than skipping the (already high-confidence) match entirely.
      const parsedGrams = parseGrams(item.estimatedServingSize);
      const grams = parsedGrams !== null && parsedGrams > 0 ? parsedGrams : match.servingWeightG;

      const perGram = 1 / match.servingWeightG;
      const scale = grams * perGram;

      return {
        ...item,
        calories: Math.round(match.calories * scale),
        proteinG: Math.round(match.proteinG * scale * 10) / 10,
        carbsG: Math.round(match.carbsG * scale * 10) / 10,
        fatG: Math.round(match.fatG * scale * 10) / 10,
        fiberG: match.fiberG != null ? Math.round(match.fiberG * scale * 10) / 10 : item.fiberG,
        sugarG: match.sugarG != null ? Math.round(match.sugarG * scale * 10) / 10 : item.sugarG,
        sodiumMg: match.sodiumMg != null ? Math.round(match.sodiumMg * scale) : item.sodiumMg,
        cholesterolMg: match.cholesterolMg != null ? Math.round(match.cholesterolMg * scale) : item.cholesterolMg,
        saturatedFatG: match.saturatedFatG != null ? Math.round(match.saturatedFatG * scale * 10) / 10 : item.saturatedFatG,
        potassiumMg: match.potassiumMg != null ? Math.round(match.potassiumMg * scale) : item.potassiumMg,
        vitaminDMcg: match.vitaminDMcg != null ? Math.round(match.vitaminDMcg * scale * 10) / 10 : item.vitaminDMcg,
        calciumMg: match.calciumMg != null ? Math.round(match.calciumMg * scale) : item.calciumMg,
        ironMg: match.ironMg != null ? Math.round(match.ironMg * scale * 10) / 10 : item.ironMg,
        name: groundedDisplayName(match),
      };
    }),
  );

  const totalCalories = groundedItems.reduce((s, i) => s + i.calories * i.quantity, 0);
  const totalProteinG = groundedItems.reduce((s, i) => s + i.proteinG * i.quantity, 0);
  const totalCarbsG = groundedItems.reduce((s, i) => s + i.carbsG * i.quantity, 0);
  const totalFatG = groundedItems.reduce((s, i) => s + i.fatG * i.quantity, 0);

  return {
    ...analysis,
    items: groundedItems,
    totalCalories: Math.round(totalCalories),
    totalProteinG: Math.round(totalProteinG * 10) / 10,
    totalCarbsG: Math.round(totalCarbsG * 10) / 10,
    totalFatG: Math.round(totalFatG * 10) / 10,
  };
}
