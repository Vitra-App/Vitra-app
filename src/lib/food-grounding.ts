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

async function findBestMatch(itemName: string): Promise<Candidate | null> {
  const words = normalizeWords(itemName);
  if (words.length === 0) return null;

  const selectFields = {
    name: true, brand: true, servingWeightG: true, calories: true,
    proteinG: true, carbsG: true, fatG: true, fiberG: true, sugarG: true,
    sodiumMg: true, cholesterolMg: true, saturatedFatG: true, potassiumMg: true,
    vitaminDMcg: true, calciumMg: true, ironMg: true,
  } as const;

  // ── Phase 1: targeted brand-phrase lookup ──────────────────────────────
  // If the item name contains a likely brand (2+ consecutive capitalized/named
  // words, e.g. "Bell & Evans", "Tyson", "Chobani"), search the `brand` column
  // directly. This is a small, precise query that can't be crowded out by a
  // generic word like "chicken" appearing in thousands of unrelated rows.
  const rawWords = itemName.split(/\s+/).filter(Boolean);
  const brandPhraseCandidates = new Set<string>();
  for (let len = Math.min(3, rawWords.length); len >= 2; len--) {
    for (let i = 0; i + len <= rawWords.length; i++) {
      const phrase = rawWords.slice(i, i + len).join(' ').replace(/[^\p{L}\p{N}&'\s-]/gu, '').trim();
      if (phrase.length >= 4) brandPhraseCandidates.add(phrase);
    }
  }

  let phase1: Candidate[] = [];
  if (brandPhraseCandidates.size > 0) {
    phase1 = await prisma.food.findMany({
      where: {
        NOT: { source: 'ai' },
        OR: Array.from(brandPhraseCandidates).map((p) => ({
          brand: { contains: p, mode: 'insensitive' as const },
        })),
      },
      select: selectFields,
      take: 40,
    });
  }

  let best: Candidate | null = null;
  let bestScore = 0;
  for (const c of phase1) {
    if (!c.servingWeightG || c.servingWeightG <= 0) continue;
    const score = scoreMatch(words, c.name, itemName, c.brand);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  // A brand-phrase hit is already a very high-confidence signal -- accept it on
  // a lower bar than the generic fallback below.
  if (best && bestScore >= 0.5) return best;

  // ── Phase 2: word-overlap fallback, prioritizing the rarest/most specific
  // word in the item name (e.g. "evans" or "patty" rather than "chicken") so a
  // fixed take-limit doesn't get crowded out by an extremely common word. ──
  const wordCounts = await Promise.all(
    words.map(async (w) => ({
      word: w,
      count: await prisma.food.count({ where: { NOT: { source: 'ai' }, name: { contains: w, mode: 'insensitive' as const } } }),
    })),
  );
  const rarestFirst = wordCounts.filter((w) => w.count > 0).sort((a, b) => a.count - b.count);
  if (rarestFirst.length === 0) return null;

  // Search using only the 2 rarest words -- keeps the candidate set small and
  // relevant instead of the broadest, most common word dominating the results.
  const targetWords = rarestFirst.slice(0, 2).map((w) => w.word);
  const candidates = await prisma.food.findMany({
    where: {
      NOT: { source: 'ai' },
      OR: targetWords.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })),
    },
    select: selectFields,
    take: 100,
  });

  for (const c of candidates) {
    if (!c.servingWeightG || c.servingWeightG <= 0) continue;
    const score = scoreMatch(words, c.name, itemName, c.brand);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  // Require a reasonably confident match before trusting it over the AI's own estimate.
  return bestScore >= 0.6 ? best : null;
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
