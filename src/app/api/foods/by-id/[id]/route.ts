import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const food = await prisma.food.findUnique({
    where: { id },
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
    },
  });
  if (!food) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(food);
}
