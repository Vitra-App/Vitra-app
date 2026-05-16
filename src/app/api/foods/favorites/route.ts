import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const FOOD_SELECT = {
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
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const rows = await prisma.favoriteFood.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: { food: { select: FOOD_SELECT } },
  });

  return NextResponse.json(rows.map((r) => r.food));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const foodId = typeof body?.foodId === 'string' ? body.foodId : null;
  if (!foodId) return NextResponse.json({ error: 'foodId required' }, { status: 400 });

  // Verify food exists
  const food = await prisma.food.findUnique({ where: { id: foodId }, select: { id: true } });
  if (!food) return NextResponse.json({ error: 'Food not found' }, { status: 404 });

  await prisma.favoriteFood.upsert({
    where: { userId_foodId: { userId: session.user.id, foodId } },
    create: { userId: session.user.id, foodId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
