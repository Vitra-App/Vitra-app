import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { dailyTag } from '@/lib/data-cache';

type Params = { params: Promise<{ id: string }> };

const NUTRIENT_KEYS = [
  'calories', 'proteinG', 'carbsG', 'fatG', 'fiberG',
  'sugarG', 'sodiumMg', 'cholesterolMg', 'saturatedFatG',
  'potassiumMg', 'vitaminDMcg', 'calciumMg', 'ironMg',
] as const;

type NutrientTotals = Record<typeof NUTRIENT_KEYS[number], number>;

function zeroTotals(): NutrientTotals {
  return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0, cholesterolMg: 0, saturatedFatG: 0, potassiumMg: 0, vitaminDMcg: 0, calciumMg: 0, ironMg: 0 };
}

function sumItems(items: NutrientTotals[]): NutrientTotals {
  return items.reduce((acc, i) => {
    for (const k of NUTRIENT_KEYS) acc[k] += i[k];
    return acc;
  }, zeroTotals());
}

// ── GET /api/meals/[id] ──────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const meal = await prisma.meal.findUnique({
    where: { id },
    include: {
      mealItems: {
        include: {
          food: {
            select: {
              id: true, name: true, brand: true, servingSize: true,
              servingWeightG: true, densityGPerMl: true,
              calories: true, proteinG: true, carbsG: true, fatG: true,
              fiberG: true, isCustom: true,
            },
          },
        },
      },
    },
  });

  if (!meal || meal.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(meal);
}

// ── PATCH /api/meals/[id] ─────────────────────────────────────────────────────
const patchSchema = z.object({
  items: z.array(
    z.object({ foodId: z.string(), servingCount: z.number().positive() }),
  ).min(1),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const meal = await prisma.meal.findUnique({
    where: { id },
    include: { mealItems: true },
  });

  if (!meal || meal.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { items } = parsed.data;
  const foodIds = items.map((i) => i.foodId);
  const foods = await prisma.food.findMany({ where: { id: { in: foodIds } } });
  const foodMap = new Map(foods.map((f) => [f.id, f]));

  const newItemData = items.map(({ foodId, servingCount }) => {
    const f = foodMap.get(foodId);
    if (!f) throw new Error(`Food not found: ${foodId}`);
    return {
      foodId,
      servingCount,
      calories: f.calories * servingCount,
      proteinG: f.proteinG * servingCount,
      carbsG: f.carbsG * servingCount,
      fatG: f.fatG * servingCount,
      fiberG: (f.fiberG ?? 0) * servingCount,
      sugarG: (f.sugarG ?? 0) * servingCount,
      sodiumMg: (f.sodiumMg ?? 0) * servingCount,
      cholesterolMg: (f.cholesterolMg ?? 0) * servingCount,
      saturatedFatG: (f.saturatedFatG ?? 0) * servingCount,
      potassiumMg: (f.potassiumMg ?? 0) * servingCount,
      vitaminDMcg: (f.vitaminDMcg ?? 0) * servingCount,
      calciumMg: (f.calciumMg ?? 0) * servingCount,
      ironMg: (f.ironMg ?? 0) * servingCount,
    };
  });

  // Calculate diff for daily summary
  const oldTotals = sumItems(meal.mealItems as unknown as NutrientTotals[]);
  const newTotals = sumItems(newItemData);

  // Replace items transactionally
  await prisma.$transaction([
    prisma.mealItem.deleteMany({ where: { mealId: id } }),
    prisma.mealItem.createMany({ data: newItemData.map((d) => ({ ...d, mealId: id })) }),
  ]);

  // Adjust daily summary by diff
  const mealDay = new Date(meal.loggedAt);
  mealDay.setUTCHours(0, 0, 0, 0);
  const diff: Record<string, number> = {};
  for (const k of NUTRIENT_KEYS) diff[k] = newTotals[k] - oldTotals[k];

  await prisma.dailyNutritionSummary.upsert({
    where: { userId_date: { userId: meal.userId, date: mealDay } },
    update: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, { increment: diff[k] }])),
    create: { userId: meal.userId, date: mealDay, ...newTotals },
  });

  const dateStr = mealDay.toISOString().slice(0, 10);
  revalidateTag(dailyTag(meal.userId, dateStr));

  const updated = await prisma.meal.findUnique({
    where: { id },
    include: { mealItems: { include: { food: { select: { id: true, name: true, brand: true, servingSize: true, servingWeightG: true, densityGPerMl: true, calories: true, proteinG: true, carbsG: true, fatG: true, fiberG: true, isCustom: true } } } } },
  });

  return NextResponse.json(updated);
}

// ── DELETE /api/meals/[id] ────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const meal = await prisma.meal.findUnique({
    where: { id },
    include: { mealItems: true },
  });

  if (!meal || meal.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const oldTotals = sumItems(meal.mealItems as unknown as NutrientTotals[]);

  await prisma.meal.delete({ where: { id } });

  // Subtract from daily summary
  const mealDay = new Date(meal.loggedAt);
  mealDay.setUTCHours(0, 0, 0, 0);

  await prisma.dailyNutritionSummary.updateMany({
    where: { userId: meal.userId, date: mealDay },
    data: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, { decrement: oldTotals[k] }])),
  });

  const dateStr = mealDay.toISOString().slice(0, 10);
  revalidateTag(dailyTag(meal.userId, dateStr));

  return NextResponse.json({ ok: true });
}
