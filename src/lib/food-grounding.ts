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

async function findBestMatch(itemName: string): Promise<Candidate | null> {
  const words = normalizeWords(itemName);
  if (words.length === 0) return null;

  const candidates = await prisma.food.findMany({
    where: {
      NOT: { source: 'ai' },
      OR: [
        ...words.map((w) => ({ name: { contains: w, mode: 'insensitive' as const } })),
        ...words.map((w) => ({ brand: { contains: w, mode: 'insensitive' as const } })),
      ],
    },
    select: {
      name: true, brand: true, servingWeightG: true, calories: true,
      proteinG: true, carbsG: true, fatG: true, fiberG: true, sugarG: true,
      sodiumMg: true, cholesterolMg: true, saturatedFatG: true, potassiumMg: true,
      vitaminDMcg: true, calciumMg: true, ironMg: true,
    },
    take: 60,
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
        name: match.brand ? `${match.brand} ${match.name}`.trim() : item.name,
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
