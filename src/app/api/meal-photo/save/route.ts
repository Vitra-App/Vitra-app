import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const itemSchema = z.object({
  name: z.string().min(1),
  estimatedServingSize: z.string(),
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
});

const schema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  items: z.array(itemSchema).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { mealType, items } = parsed.data;
  const userId = session.user.id;

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
          isCustom: true,
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
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        cholesterolMg: 0,
        saturatedFatG: 0,
        potassiumMg: 0,
        vitaminDMcg: 0,
        calciumMg: 0,
        ironMg: 0,
      };
    }),
  );

  const meal = await prisma.meal.create({
    data: {
      userId,
      mealType,
      aiAnalyzed: true,
      mealItems: { createMany: { data: mealItemData } },
    },
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
      fiberG: 0, sugarG: 0, sodiumMg: 0, cholesterolMg: 0,
      saturatedFatG: 0, potassiumMg: 0, vitaminDMcg: 0, calciumMg: 0, ironMg: 0,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0, cholesterolMg: 0, saturatedFatG: 0, potassiumMg: 0, vitaminDMcg: 0, calciumMg: 0, ironMg: 0 },
  );

  await prisma.dailyNutritionSummary.upsert({
    where: { userId_date: { userId, date: dayStart } },
    update: {
      calories: { increment: totals.calories },
      proteinG: { increment: totals.proteinG },
      carbsG: { increment: totals.carbsG },
      fatG: { increment: totals.fatG },
    },
    create: { userId, date: dayStart, ...totals },
  });

  return NextResponse.json(meal, { status: 201 });
}
