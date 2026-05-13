import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// POST /api/foods/import
// Persist a USDA (or other external) food into the local DB so it can be
// referenced from a meal entry. Idempotent on (source, externalId).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { source, externalId } = body ?? {};
  if (!source || !externalId) {
    return NextResponse.json({ error: 'Missing source/externalId' }, { status: 400 });
  }

  const existing = await prisma.food.findFirst({
    where: { source, externalId: String(externalId) },
  });
  if (existing) return NextResponse.json(existing);

  const created = await prisma.food.create({
    data: {
      name: body.name,
      brand: body.brand ?? null,
      barcode: body.barcode ?? null,
      source,
      externalId: String(externalId),
      servingSize: body.servingSize ?? '100 g',
      servingWeightG: Number(body.servingWeightG ?? 100),
      densityGPerMl: body.densityGPerMl ?? null,
      calories: Number(body.calories ?? 0),
      proteinG: Number(body.proteinG ?? 0),
      carbsG: Number(body.carbsG ?? 0),
      fatG: Number(body.fatG ?? 0),
      fiberG: body.fiberG ?? null,
      sugarG: body.sugarG ?? null,
      sodiumMg: body.sodiumMg ?? null,
      cholesterolMg: body.cholesterolMg ?? null,
      saturatedFatG: body.saturatedFatG ?? null,
      potassiumMg: body.potassiumMg ?? null,
      vitaminDMcg: body.vitaminDMcg ?? null,
      calciumMg: body.calciumMg ?? null,
      ironMg: body.ironMg ?? null,
    },
  });

  return NextResponse.json(created);
}
