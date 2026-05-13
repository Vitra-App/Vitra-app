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
  if (existing) return NextResponse.json(existing);

  const off = await fetchOpenFoodFactsByBarcode(barcode);
  if (!off) {
    return NextResponse.json(
      { error: 'Product not found', barcode },
      { status: 404 },
    );
  }

  const created = await prisma.food.create({ data: off });
  return NextResponse.json(created);
}
