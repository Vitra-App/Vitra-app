import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { dailyTag } from '@/lib/data-cache';

const itemSchema = z.object({
  name: z.string().min(1),
  estimatedServingSize: z.string(),
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  fiberG: z.number().min(0).optional().default(0),
  sugarG: z.number().min(0).optional().default(0),
  sodiumMg: z.number().min(0).optional().default(0),
  cholesterolMg: z.number().min(0).optional().default(0),
  saturatedFatG: z.number().min(0).optional().default(0),
  potassiumMg: z.number().min(0).optional().default(0),
  vitaminDMcg: z.number().min(0).optional().default(0),
  calciumMg: z.number().min(0).optional().default(0),
  ironMg: z.number().min(0).optional().default(0),
});

const schema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z.array(itemSchema).min(1),
  // Local calendar day (YYYY-MM-DD) the user intends this meal to be logged on.
  // Without this, we previously defaulted to the server's raw UTC "now", which for any
  // timezone behind UTC (all of the Americas) rolls over to the next UTC calendar day in the
  // evening — exactly when dinner is logged. That silently filed dinner meals under tomorrow's
  // UTC bucket, making them vanish from "today"'s log/dashboard. Anchoring to noon UTC of the
  // client-supplied local date (same pattern already used by the manual food-log endpoint)
  // fixes this for any timezone from UTC-12 to UTC+14.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { mealType, items, date } = parsed.data;
  const userId = session.user.id;

  // Noon-UTC anchor of the intended local day — safe from day-boundary rollover in either
  // direction for any real-world timezone offset (±14h max).
  const dateStr = date ?? new Date().toISOString().slice(0, 10);
  const loggedAt = new Date(`${dateStr}T12:00:00.000Z`);
  const dayBucket = new Date(`${dateStr}T00:00:00.000Z`);

  // Create a custom food record for each photo-detected item
  const mealItemData = await Promise.all(
    items.map(async (item) => {
      const food = await prisma.food.create({
        data: {
          name: item.name,
          servingSize: item.estimatedServingSize,
          servingWeightG: 100,
          calories: item.calories,
          proteinG: item.proteinG,
          carbsG: item.carbsG,
          fatG: item.fatG,
          fiberG: item.fiberG,
          sugarG: item.sugarG,
          sodiumMg: item.sodiumMg,
          cholesterolMg: item.cholesterolMg,
          saturatedFatG: item.saturatedFatG,
          potassiumMg: item.potassiumMg,
          vitaminDMcg: item.vitaminDMcg,
          calciumMg: item.calciumMg,
          ironMg: item.ironMg,
          // AI-detected foods are NOT user custom foods: they must not appear in
          // "My Foods" or global search. isCustom stays false and source = 'ai'.
          isCustom: false,
          source: 'ai',
          createdBy: userId,
        },
      });
      return {
        foodId: food.id,
        servingCount: 1,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        fiberG: item.fiberG,
        sugarG: item.sugarG,
        sodiumMg: item.sodiumMg,
        cholesterolMg: item.cholesterolMg,
        saturatedFatG: item.saturatedFatG,
        potassiumMg: item.potassiumMg,
        vitaminDMcg: item.vitaminDMcg,
        calciumMg: item.calciumMg,
        ironMg: item.ironMg,
      };
    }),
  );

  const meal = await prisma.meal.create({
    data: {
      userId,
      mealType,
      loggedAt,
      aiAnalyzed: true,
      mealItems: { createMany: { data: mealItemData } },
    },
  });

  // Update daily summary for the same client-intended local day used above --
  // NOT the server's raw "now", which caused this cached summary row to silently
  // drift onto the wrong day for any evening entry (same class of bug fixed
  // earlier for loggedAt/dayBucket).
  const totals = mealItemData.reduce(
    (acc, i) => ({
      calories: acc.calories + i.calories,
      proteinG: acc.proteinG + i.proteinG,
      carbsG: acc.carbsG + i.carbsG,
      fatG: acc.fatG + i.fatG,
      fiberG: 0, sugarG: 0, sodiumMg: 0, cholesterolMg: 0,
      saturatedFatG: 0, potassiumMg: 0, vitaminDMcg: 0, calciumMg: 0, ironMg: 0,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0, cholesterolMg: 0, saturatedFatG: 0, potassiumMg: 0, vitaminDMcg: 0, calciumMg: 0, ironMg: 0 },
  );

  await prisma.dailyNutritionSummary.upsert({
    where: { userId_date: { userId, date: dayBucket } },
    update: {
      calories: { increment: totals.calories },
      proteinG: { increment: totals.proteinG },
      carbsG: { increment: totals.carbsG },
      fatG: { increment: totals.fatG },
    },
    create: { userId, date: dayBucket, ...totals },
  });

  revalidateTag(dailyTag(userId, dateStr));

  return NextResponse.json(meal, { status: 201 });
}
