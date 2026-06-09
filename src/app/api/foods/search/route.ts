import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { searchUsdaFoods } from '@/lib/usda';
import { NextRequest, NextResponse } from 'next/server';

// ── Relevance scoring ────────────────────────────────────────────────────────
// Returns a composite score: lower = better match.
// Structured as: TIER * 1000 + CALORIE_PENALTY * 100 + LENGTH_PENALTY
// This keeps tiers strictly ordered while breaking ties with calories then length.

function scoreFood(name: string, brand: string | null, calories: number, q: string): number {
  const n = name.toLowerCase().trim();
  const ql = q.toLowerCase().trim();
  const words = n.split(/[\s,()\/]+/).filter(Boolean);
  const lastWord = words[words.length - 1];

  // ── Tier (0 = best) ────────────────────────────────────────────────────────
  let tier: number;

  if (n === ql) {
    // Exact match — but penalise if it looks like a seasoning/spice
    // (very low calories for something named like a real food = likely incomplete or seasoning)
    tier = 0;
  } else if (n.startsWith(ql + ' ') || n.startsWith(ql + ',')) {
    tier = 1; // "Steak, grilled" or "Steak sauce" — starts with query + separator
  } else if (n.startsWith(ql)) {
    tier = 2; // "Steakhouse" — starts with but no separator
  } else if (words[0] === ql) {
    tier = 3; // First word is exactly the query
  } else if (lastWord === ql) {
    tier = 4; // LAST word is query — "Ribeye Steak", "NY Strip Steak" ← KEY FIX
  } else if (words.length >= 2 && words[words.length - 2] === ql) {
    tier = 5; // Second-to-last word — "Beef Steak Strips"
  } else if (words.some((w) => w === ql)) {
    tier = 6; // Query word anywhere in the name
  } else if (words.some((w) => w.startsWith(ql))) {
    tier = 7; // A word starts with the query
  } else {
    tier = 8; // Just contains the query somewhere
  }

  // ── Calorie completeness penalty ───────────────────────────────────────────
  // 0-cal items are raw USDA entries with missing data, or seasonings.
  // Real prepared foods almost always have calories > 20.
  // This penalty is a fractional bump within the tier so it never overrides tier order.
  let calPenalty: number;
  if (calories <= 0)  calPenalty = 3;  // Raw/incomplete data — push way down within tier
  else if (calories < 15) calPenalty = 2;  // Likely seasoning/spice/flavouring
  else if (calories < 50) calPenalty = 1;  // Small serving or condiment
  else calPenalty = 0;  // Real food

  // ── Brand penalty ──────────────────────────────────────────────────────────
  // Unbranded generic foods (null brand) are more universally useful than
  // specific restaurant/brand entries when calories and tier are equal.
  const brandPenalty = brand ? 0.5 : 0;

  // ── Length penalty (tiebreaker) ────────────────────────────────────────────
  // Shorter names = more generic = more likely what the user is looking for.
  // Cap at 0.99 so it never spills into the next integer bucket.
  const lengthPenalty = Math.min(name.length / 200, 0.99);

  return tier * 10 + calPenalty + brandPenalty + lengthPenalty;
}

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10);

  // ── 1. Local DB ──────────────────────────────────────────────────────────
  const localFoods = await prisma.food.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    select: {
      id: true, name: true, brand: true, servingSize: true, servingWeightG: true,
      densityGPerMl: true, calories: true, proteinG: true, carbsG: true, fatG: true,
      fiberG: true, sugarG: true, sodiumMg: true, cholesterolMg: true,
      saturatedFatG: true, potassiumMg: true, vitaminDMcg: true,
      calciumMg: true, ironMg: true,
    },
    take: 80,
  });

  // ── 2. USDA — fetch more results so we have more to rank ─────────────────
  const usdaPageSize = offset === 0 ? 30 : 25;
  const usdaRaw = await searchUsdaFoods(q, usdaPageSize, offset).catch(() => []);

  const usdaFoods = await Promise.all(
    usdaRaw.map(async (u) => {
      const existing = await prisma.food.findFirst({
        where: { name: u.name, brand: u.brand ?? undefined },
      });
      if (existing) return existing;
      return prisma.food.create({
        data: {
          name: u.name, brand: u.brand, servingSize: u.servingSize,
          servingWeightG: u.servingWeightG, calories: u.calories,
          proteinG: u.proteinG, carbsG: u.carbsG, fatG: u.fatG,
          fiberG: u.fiberG, sugarG: u.sugarG, sodiumMg: u.sodiumMg,
          cholesterolMg: u.cholesterolMg, saturatedFatG: u.saturatedFatG,
          potassiumMg: u.potassiumMg, vitaminDMcg: u.vitaminDMcg,
          calciumMg: u.calciumMg, ironMg: u.ironMg,
        },
      });
    }),
  );

  // ── 3. Merge, deduplicate, score & sort ──────────────────────────────────
  const seen = new Set<string>();
  const merged = [...localFoods, ...usdaFoods].filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  merged.sort((a, b) =>
    scoreFood(a.name, a.brand, a.calories, q) -
    scoreFood(b.name, b.brand, b.calories, q)
  );

  return NextResponse.json(merged.slice(offset, offset + PAGE_SIZE));
}
