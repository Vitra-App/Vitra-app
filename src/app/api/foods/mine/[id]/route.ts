import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/foods/mine/[id]  -> update one of the user's custom foods
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || food.createdBy !== session.user.id || !food.isCustom) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const num = (v: unknown, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
  const numOrNull = (v: unknown) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const updated = await prisma.food.update({
    where: { id },
    data: {
      name,
      brand: body.brand?.toString().trim() || null,
      barcode: body.barcode?.toString().trim() || null,
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
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/foods/mine/[id]  -> delete one of the user's custom foods
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const food = await prisma.food.findUnique({ where: { id } });
  if (!food || food.createdBy !== session.user.id || !food.isCustom) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Refuse if any meal items reference this food (would orphan them).
  const refs = await prisma.mealItem.count({ where: { foodId: id } });
  if (refs > 0) {
    return NextResponse.json(
      { error: `Cannot delete — used in ${refs} meal item(s).` },
      { status: 409 },
    );
  }

  await prisma.food.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
