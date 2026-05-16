import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateWeeklySummary } from '@/lib/ai-service';
import { rateLimit } from '@/lib/rate-limit';

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 3 weekly summary generations per hour per user
  const rl = rateLimit(`weekly:${session.user.id}`, 3, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil(rl.retryAfterMs / 60000)} min.` },
      { status: 429 },
    );
  }

  const userId = session.user.id;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [profile, weeklySummaries] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.dailyNutritionSummary.findMany({
      where: { userId, date: { gte: sevenDaysAgo, lte: today } },
      orderBy: { date: 'asc' },
      select: { date: true, calories: true, proteinG: true, carbsG: true, fatG: true, fiberG: true, sodiumMg: true },
    }),
  ]);

  // Build full 7-day array (fill missing days with 0)
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = weeklySummaries.find((s) => s.date.toISOString().slice(0, 10) === dateStr);
    days.push({
      date: dateStr,
      calories: found?.calories ?? 0,
      proteinG: found?.proteinG ?? 0,
      carbsG: found?.carbsG ?? 0,
      fatG: found?.fatG ?? 0,
      fiberG: found?.fiberG ?? 0,
      sodiumMg: found?.sodiumMg ?? 0,
    });
  }

  const content = await generateWeeklySummary(profile, days);

  // Save / overwrite this week's summary insight
  const startOfWeek = sevenDaysAgo;
  const existing = await prisma.aIInsight.findFirst({
    where: { userId, insightType: 'weekly_summary', contextDate: startOfWeek },
  });

  if (existing) {
    await prisma.aIInsight.update({
      where: { id: existing.id },
      data: { content, generatedAt: new Date() },
    });
  } else {
    await prisma.aIInsight.create({
      data: { userId, insightType: 'weekly_summary', content, contextDate: startOfWeek },
    });
  }

  return NextResponse.json({ content });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const insight = await prisma.aIInsight.findFirst({
    where: { userId: session.user.id, insightType: 'weekly_summary' },
    orderBy: { generatedAt: 'desc' },
  });

  return NextResponse.json({ content: insight?.content ?? null, generatedAt: insight?.generatedAt ?? null });
}
