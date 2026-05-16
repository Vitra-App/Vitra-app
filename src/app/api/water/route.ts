import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  waterMl: z.number().int().min(0).max(10000),
});

// PATCH /api/water  — set water intake for today
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const summary = await prisma.dailyNutritionSummary.upsert({
    where: { userId_date: { userId: session.user.id, date: today } },
    update: { waterMl: parsed.data.waterMl },
    create: {
      userId: session.user.id,
      date: today,
      waterMl: parsed.data.waterMl,
    },
    select: { waterMl: true },
  });

  return NextResponse.json(summary);
}

// GET /api/water  — get today's water intake
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const summary = await prisma.dailyNutritionSummary.findUnique({
    where: { userId_date: { userId: session.user.id, date: today } },
    select: { waterMl: true },
  });

  return NextResponse.json({ waterMl: summary?.waterMl ?? 0 });
}
