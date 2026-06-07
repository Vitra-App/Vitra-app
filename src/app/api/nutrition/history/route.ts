import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/nutrition/history?days=30
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
  const userId = session.user.id;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const summaries = await prisma.dailyNutritionSummary.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      fiberG: true,
      sugarG: true,
      sodiumMg: true,
    },
  });

  const result = summaries.map((s) => ({
    date: s.date.toISOString().split('T')[0],
    calories: s.calories,
    proteinG: s.proteinG,
    carbsG: s.carbsG,
    fatG: s.fatG,
    fiberG: s.fiberG,
    sugarG: s.sugarG,
    sodiumMg: s.sodiumMg,
  }));

  return NextResponse.json(result);
}
