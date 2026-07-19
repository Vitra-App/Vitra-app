import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export type CustomMealItemPayload = {
  foodId: string;
  foodName: string;
  servingCount: number;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const meals = await prisma.customMeal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          food: { select: { id: true, name: true, calories: true } },
        },
      },
    },
  });

  const result = meals.map((m) => {
    const totalCals = Math.round(
      m.items.reduce((s, i) => s + i.food.calories * i.servingCount, 0),
    );
    return {
      id: m.id,
      name: m.name,
      totalCals,
      createdAt: m.createdAt,
      items: m.items.map((i) => ({
        foodId: i.food.id,
        foodName: i.food.name,
        servingCount: i.servingCount,
      })),
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const items: CustomMealItemPayload[] = Array.isArray(body?.items) ? body.items : [];

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (items.length === 0) return NextResponse.json({ error: 'items required' }, { status: 400 });

  const created = await prisma.customMeal.create({
    data: {
      userId: session.user.id,
      name,
      items: {
        create: items.map((i) => ({
          foodId: i.foodId,
          servingCount: i.servingCount,
        })),
      },
    },
    include: {
      items: { include: { food: { select: { id: true, name: true, calories: true } } } },
    },
  });

  const totalCals = Math.round(
    created.items.reduce((s, i) => s + i.food.calories * i.servingCount, 0),
  );

  return NextResponse.json({
    id: created.id,
    name: created.name,
    totalCals,
    createdAt: created.createdAt,
    items: created.items.map((i) => ({
      foodId: i.food.id,
      foodName: i.food.name,
      servingCount: i.servingCount,
    })),
  });
}
