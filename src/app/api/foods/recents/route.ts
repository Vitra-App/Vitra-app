import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  // Get the most recent unique foods logged by this user
  const items = await prisma.mealItem.findMany({
    where: {
      meal: { userId: session.user.id },
    },
    orderBy: { meal: { loggedAt: 'desc' } },
    take: 200,
    select: {
      food: {
        select: {
          id: true,
          name: true,
          brand: true,
          servingSize: true,
          servingWeightG: true,
          densityGPerMl: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          fiberG: true,
          sugarG: true,
          sodiumMg: true,
          cholesterolMg: true,
          saturatedFatG: true,
          potassiumMg: true,
          vitaminDMcg: true,
          calciumMg: true,
          ironMg: true,
          isCustom: true,
        },
      },
    },
  });

  // Deduplicate by food id, preserving first-seen order (most recent)
  const seen = new Set<string>();
  const unique = [];
  for (const item of items) {
    if (!seen.has(item.food.id)) {
      seen.add(item.food.id);
      unique.push(item.food);
    }
    if (unique.length >= 30) break;
  }

  return NextResponse.json(unique);
}
