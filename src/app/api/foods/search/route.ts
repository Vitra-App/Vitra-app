import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { searchUsdaFoods } from '@/lib/usda';
import { NextRequest, NextResponse } from 'next/server';

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
    take: 10,
    orderBy: { name: 'asc' },
  });

  // ── 2. USDA (if key is set) ──────────────────────────────────────────────
  const usdaRaw = await searchUsdaFoods(q, 15).catch(() => []);

  // Upsert USDA results into local DB so future searches are faster
  const usdaFoods = await Promise.all(
    usdaRaw.map(async (u) => {
      const existing = await prisma.food.findFirst({
        where: { name: u.name, brand: u.brand ?? undefined },
      });
      if (existing) return existing;
      return prisma.food.create({
        data: {
          name: u.name,
          brand: u.brand,
          servingSize: u.servingSize,
          servingWeightG: u.servingWeightG,
          calories: u.calories,
          proteinG: u.proteinG,
          carbsG: u.carbsG,
          fatG: u.fatG,
          fiberG: u.fiberG,
          sugarG: u.sugarG,
          sodiumMg: u.sodiumMg,
          cholesterolMg: u.cholesterolMg,
          saturatedFatG: u.saturatedFatG,
          potassiumMg: u.potassiumMg,
          vitaminDMcg: u.vitaminDMcg,
          calciumMg: u.calciumMg,
          ironMg: u.ironMg,
        },
      });
    }),
  );

  // ── 3. Merge, deduplicate by id, cap at 25 ───────────────────────────────
  const seen = new Set<string>();
  const merged = [...localFoods, ...usdaFoods].filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  }).slice(0, 25);

  return NextResponse.json(merged);
}
