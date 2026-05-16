import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/export/nutrition?days=30
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Math.min(Number(req.nextUrl.searchParams.get('days') ?? '30'), 365);

  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days + 1);

  const rows = await prisma.dailyNutritionSummary.findMany({
    where: { userId: session.user.id, date: { gte: cutoff } },
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
      cholesterolMg: true,
      saturatedFatG: true,
      potassiumMg: true,
      vitaminDMcg: true,
      calciumMg: true,
      ironMg: true,
      waterMl: true,
    },
  });

  const header = 'Date,Calories,Protein (g),Carbs (g),Fat (g),Fiber (g),Sugar (g),Sodium (mg),Cholesterol (mg),Sat Fat (g),Potassium (mg),Vitamin D (mcg),Calcium (mg),Iron (mg),Water (ml)\n';

  const csvRows = rows
    .map((r) =>
      [
        r.date.toISOString().slice(0, 10),
        r.calories.toFixed(1),
        r.proteinG.toFixed(1),
        r.carbsG.toFixed(1),
        r.fatG.toFixed(1),
        r.fiberG.toFixed(1),
        r.sugarG.toFixed(1),
        r.sodiumMg.toFixed(1),
        r.cholesterolMg.toFixed(1),
        r.saturatedFatG.toFixed(1),
        r.potassiumMg.toFixed(1),
        r.vitaminDMcg.toFixed(1),
        r.calciumMg.toFixed(1),
        r.ironMg.toFixed(1),
        r.waterMl.toFixed(0),
      ].join(','),
    )
    .join('\n');

  const csv = header + csvRows;
  const filename = `vitra-nutrition-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
