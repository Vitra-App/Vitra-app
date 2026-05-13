import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET  /api/foods/mine  -> list current user's custom foods
// POST /api/foods/mine  -> create a new custom food owned by the user
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const foods = await prisma.food.findMany({
    where: { createdBy: session.user.id, isCustom: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(foods);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const num = (v: unknown, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const numOrNull = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const food = await prisma.food.create({
    data: {
      name,
      brand: body.brand?.toString().trim() || null,
      barcode: body.barcode?.toString().trim() || null,
      source: body.source === 'meal' ? 'meal' : 'custom',
      externalId: null,
      servingSize: String(body.servingSize ?? '1 serving'),
      servingWeightG: num(body.servingWeightG, 100),
      densityGPerMl: numOrNull(body.densityGPerMl),
      calories: num(body.calories),
      proteinG: num(body.proteinG),
      carbsG: num(body.carbsG),
      fatG: num(body.fatG),
      fiberG: numOrNull(body.fiberG),
      sugarG: numOrNull(body.sugarG),
      sodiumMg: numOrNull(body.sodiumMg),
      cholesterolMg: numOrNull(body.cholesterolMg),
      saturatedFatG: numOrNull(body.saturatedFatG),
      potassiumMg: numOrNull(body.potassiumMg),
      vitaminDMcg: numOrNull(body.vitaminDMcg),
      calciumMg: numOrNull(body.calciumMg),
      ironMg: numOrNull(body.ironMg),
      isCustom: true,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(food);
}
