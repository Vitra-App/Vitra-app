import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([]);

  const foods = await prisma.food.findMany({
    where: {
      name: { contains: q, mode: 'insensitive' },
    },
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
    },
    take: 20,
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(foods);
}
