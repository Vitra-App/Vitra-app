import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// GET /api/weight?limit=30  — fetch recent weight entries
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '30'), 90);

  const entries = await prisma.weightEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { loggedAt: 'desc' },
    take: limit,
    select: { id: true, weightKg: true, notes: true, loggedAt: true },
  });

  return NextResponse.json(entries);
}

const schema = z.object({
  weightKg: z.number().positive().max(500),
  notes: z.string().max(200).optional(),
  loggedAt: z.string().datetime().optional(),
});

// POST /api/weight  — log a new weight entry
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { weightKg, notes, loggedAt } = parsed.data;

  const entry = await prisma.weightEntry.create({
    data: {
      userId: session.user.id,
      weightKg,
      notes,
      loggedAt: loggedAt ? new Date(loggedAt) : new Date(),
    },
  });

  // Also update the profile's current weight
  await prisma.userProfile.upsert({
    where: { userId: session.user.id },
    update: { weightKg },
    create: { userId: session.user.id, weightKg },
  });

  return NextResponse.json(entry);
}
