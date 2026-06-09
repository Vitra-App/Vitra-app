import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { fetchOpenFoodFactsByBarcode } from '@/lib/openfoodfacts';

// GET /api/foods/barcode/[code]
// 1. Look up local DB by barcode
// 2. Fall back to Open Food Facts and persist the result
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = await params;
  const barcode = code.replace(/\D/g, '');
  if (!barcode) {
    return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 });
  }

  const existing = await prisma.food.findUnique({ where: { barcode } });

  // If we have a cached record with the correct serving weight, return it.
  // servingWeightG === 100 AND source === 'openfoodfacts' means it was cached
  // with the old buggy code that always used 100g — re-fetch to get the real serving.
  if (existing && !(existing.source === 'openfoodfacts' && existing.servingWeightG === 100)) {
    return NextResponse.json(existing);
  }

  const off = await fetchOpenFoodFactsByBarcode(barcode);
  if (!off) {
    // If we have a stale cached record, return it rather than a 404
    if (existing) return NextResponse.json(existing);
    return NextResponse.json(
      { error: 'Product not found', barcode },
      { status: 404 },
    );
  }

  // Upsert so stale 100g records get corrected
  const upserted = await prisma.food.upsert({
    where: { barcode },
    create: off,
    update: {
      servingSize: off.servingSize,
      servingWeightG: off.servingWeightG,
      calories: off.calories,
      proteinG: off.proteinG,
      carbsG: off.carbsG,
      fatG: off.fatG,
      fiberG: off.fiberG,
      sugarG: off.sugarG,
      sodiumMg: off.sodiumMg,
      cholesterolMg: off.cholesterolMg,
      saturatedFatG: off.saturatedFatG,
      potassiumMg: off.potassiumMg,
    },
  });
  return NextResponse.json(upserted);
}
