import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export type FrequentMealItem = {
  foodId: string;
  foodName: string;
  servingCount: number;
};

export type FrequentMeal = {
  label: string;
  totalCals: number;
  items: FrequentMealItem[];
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const userId = session.user.id;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const meals = await prisma.meal.findMany({
    where: { userId, loggedAt: { gte: since } },
    orderBy: { loggedAt: 'desc' },
    take: 200,
    select: {
      mealType: true,
      mealItems: {
        select: {
          servingCount: true,
          food: {
            select: { id: true, name: true, calories: true },
          },
        },
      },
    },
  });

  const byType: Record<string, typeof meals> = {};
  for (const m of meals) {
    if (!byType[m.mealType]) byType[m.mealType] = [];
    byType[m.mealType].push(m);
  }

  const result: Record<string, FrequentMeal[]> = {};

  for (const [type, typeMeals] of Object.entries(byType)) {
    // Deduplicate by sorted food-ID signature; keep the most recent meal per signature
    const sigMap = new Map<string, { count: number; meal: (typeof typeMeals)[0] }>();

    for (const m of typeMeals) {
      if (m.mealItems.length === 0) continue;
      const sig = m.mealItems
        .map((i) => i.food.id)
        .sort()
        .join(',');
      const existing = sigMap.get(sig);
      if (existing) {
        existing.count++;
      } else {
        sigMap.set(sig, { count: 1, meal: m }); // first = most recent (ordered desc)
      }
    }

    const sorted = Array.from(sigMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    result[type] = sorted.map(({ meal }) => {
      const totalCals = Math.round(
        meal.mealItems.reduce((s, i) => s + i.food.calories * i.servingCount, 0),
      );
      const names = meal.mealItems.map((i) => i.food.name);
      const label =
        names.slice(0, 2).join(', ') +
        (names.length > 2 ? ` +${names.length - 2} more` : '');
      return {
        label,
        totalCals,
        items: meal.mealItems.map((i) => ({
          foodId: i.food.id,
          foodName: i.food.name,
          servingCount: i.servingCount,
        })),
      };
    });
  }

  return NextResponse.json(result);
}
