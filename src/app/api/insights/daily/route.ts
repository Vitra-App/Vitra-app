import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateDailyNutritionOutlook } from '@/lib/ai-service';

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(dayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [profile, todaySummary, weeklySummaries, bloodwork] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.dailyNutritionSummary.findFirst({ where: { userId, date: dayStart } }),
    prisma.dailyNutritionSummary.findMany({ where: { userId, date: { gte: sevenDaysAgo } } }),
    prisma.bloodworkMarker.findMany({ where: { userId } }),
  ]);

  const daily = todaySummary ?? {
    calories: 0, proteinG: 0, carbsG: 0, fatG: 0,
    fiberG: 0, vitaminDMcg: 0, ironMg: 0, calciumMg: 0,
  };

  const proteinTarget = profile?.proteinTargetG ?? 120;
  const daysUnder = weeklySummaries.filter((d) => d.proteinG < proteinTarget * 0.8).length;
  const avgCal = weeklySummaries.length
    ? weeklySummaries.reduce((s, d) => s + d.calories, 0) / weeklySummaries.length
    : 0;

  const content = await generateDailyNutritionOutlook(
    profile,
    {
      calories: daily.calories,
      proteinG: daily.proteinG,
      carbsG: daily.carbsG,
      fatG: daily.fatG,
      fiberG: daily.fiberG,
      vitaminDMcg: daily.vitaminDMcg,
      ironMg: daily.ironMg,
      calciumMg: daily.calciumMg,
    },
    {
      avgCalories: Math.round(avgCal),
      avgProteinG: Math.round(weeklySummaries.reduce((s, d) => s + d.proteinG, 0) / (weeklySummaries.length || 1)),
      daysUnderProteinTarget: daysUnder,
      daysLogged: weeklySummaries.length,
    },
    bloodwork,
  );

  const insight = await prisma.aIInsight.create({
    data: { userId, insightType: 'daily_outlook', content, contextDate: dayStart },
  });

  return NextResponse.json({ content: insight.content, generatedAt: insight.generatedAt.toISOString() });
}
