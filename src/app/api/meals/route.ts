import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { dailyTag } from '@/lib/data-cache';

const mealSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z.array(
    z.object({
      foodId: z.string(),
      servingCount: z.number().positive(),
    }),
  ).min(1),
  loggedAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = mealSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { mealType, items, loggedAt } = parsed.data;
  const userId = session.user.id;

  // Fetch all food records
  const foodIds = items.map((i) => i.foodId);
  const foods = await prisma.food.findMany({ where: { id: { in: foodIds } } });
  const foodMap = new Map(foods.map((f) => [f.id, f]));

  // Build MealItem data with nutrient snapshots
  const mealItemData = items.map(({ foodId, servingCount }) => {
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

  const meal = await prisma.meal.create({
    data: {
      userId,
      mealType,
      loggedAt: loggedAt ? new Date(loggedAt) : undefined,
      mealItems: { createMany: { data: mealItemData } },
    },
    include: { mealItems: true },
  });

  // Update daily summary
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const totals = mealItemData.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      proteinG: acc.proteinG + i.proteinG,
      carbsG: acc.carbsG + i.carbsG,
      fatG: acc.fatG + i.fatG,
      fiberG: acc.fiberG + i.fiberG,
      sugarG: acc.sugarG + i.sugarG,
      sodiumMg: acc.sodiumMg + i.sodiumMg,
      cholesterolMg: acc.cholesterolMg + i.cholesterolMg,
      saturatedFatG: acc.saturatedFatG + i.saturatedFatG,
      potassiumMg: acc.potassiumMg + i.potassiumMg,
      vitaminDMcg: acc.vitaminDMcg + i.vitaminDMcg,
      calciumMg: acc.calciumMg + i.calciumMg,
      ironMg: acc.ironMg + i.ironMg,
    }),
    {
      calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0,
      sugarG: 0, sodiumMg: 0, cholesterolMg: 0, saturatedFatG: 0,
      potassiumMg: 0, vitaminDMcg: 0, calciumMg: 0, ironMg: 0,
    },
  );

  await prisma.dailyNutritionSummary.upsert({
    where: { userId_date: { userId, date: dayStart } },
    update: {
      calories: { increment: totals.calories },
      proteinG: { increment: totals.proteinG },
      carbsG: { increment: totals.carbsG },
      fatG: { increment: totals.fatG },
      fiberG: { increment: totals.fiberG },
      sugarG: { increment: totals.sugarG },
      sodiumMg: { increment: totals.sodiumMg },
      cholesterolMg: { increment: totals.cholesterolMg },
      saturatedFatG: { increment: totals.saturatedFatG },
      potassiumMg: { increment: totals.potassiumMg },
      vitaminDMcg: { increment: totals.vitaminDMcg },
      calciumMg: { increment: totals.calciumMg },
      ironMg: { increment: totals.ironMg },
    },
    create: { userId, date: dayStart, ...totals },
  });

  const dateStr = dayStart.toISOString().slice(0, 10);
  revalidateTag(dailyTag(userId, dateStr));

  return NextResponse.json(meal, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get('date');
  const userId = session.user.id;

  const dayStart = dateParam ? new Date(dateParam) : new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const meals = await prisma.meal.findMany({
    where: { userId, loggedAt: { gte: dayStart, lte: dayEnd } },
    include: { mealItems: { include: { food: true } } },
    orderBy: { loggedAt: 'asc' },
  });

  return NextResponse.json(meals);
}
