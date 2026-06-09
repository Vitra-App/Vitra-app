import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { searchUsdaFoods } from '@/lib/usda';
import { NextRequest, NextResponse } from 'next/server';

function relevanceScore(name: string, q: string): number {
  const n = name.toLowerCase().trim();
  const ql = q.toLowerCase().trim();
  if (n === ql) return 0;                                         // exact match
  if (n.startsWith(ql + ' ') || n.startsWith(ql + ',')) return 1; // starts with + separator
  if (n.startsWith(ql)) return 2;                                 // starts with (no separator)
  const words = n.split(/[\s,]+/);
  if (words[0] === ql) return 3;                                  // first word exact
  if (words.some((w: string) => w === ql)) return 4;              // any whole word exact
  if (words.some((w: string) => w.startsWith(ql))) return 5;      // any word starts with
  return 6;                                                       // just contains somewhere
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

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
    take: 40,
  });

  // ── 2. USDA ──────────────────────────────────────────────────────────────
  const usdaRaw = await searchUsdaFoods(q, 15).catch(() => []);

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

  // ── 3. Merge, deduplicate, sort by relevance ──────────────────────────────
  const seen = new Set<string>();
  const merged = [...localFoods, ...usdaFoods].filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });

  merged.sort((a, b) => {
    const diff = relevanceScore(a.name, q) - relevanceScore(b.name, q);
    if (diff !== 0) return diff;
    // Within same tier: shorter = more generic = more likely what user wants
    return a.name.length - b.name.length;
  });

  return NextResponse.json(merged.slice(offset, offset + PAGE_SIZE));
}
