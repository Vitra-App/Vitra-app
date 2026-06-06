import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/nutrition/daily?date=YYYY-MM-DD
// Returns the daily nutrition summary for the given date (defaults to today).
// Used by the Vitra iOS app dashboard.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const dateParam = req.nextUrl.searchParams.get('date');
  const day = dateParam ? new Date(dateParam + 'T00:00:00.000Z') : new Date();
  day.setUTCHours(0, 0, 0, 0);

  const summary = await prisma.dailyNutritionSummary.findUnique({
    where: { userId_date: { userId: session.user.id, date: day } },
    select: {
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      fiberG: true,
      sugarG: true,
      sodiumMg: true,
      waterMl: true,
    },
  });

  return NextResponse.json(
    summary ?? {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      fiberG: 0,
      sugarG: 0,
      sodiumMg: 0,
      waterMl: 0,
    },
  );
}
