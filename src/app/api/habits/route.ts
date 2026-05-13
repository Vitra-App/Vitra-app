import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  icon: z.string().max(10).optional(),
  category: z.string().max(50).optional(),
  sourceType: z.string().max(50).optional(),
  sourceRef: z.string().max(200).optional(),
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(habits);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  // Prevent duplicates for the same user + name
  const existing = await prisma.habit.findFirst({
    where: { userId: session.user.id, name: parsed.data.name, isActive: true },
  });
  if (existing) return NextResponse.json(existing);

  const habit = await prisma.habit.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      icon: parsed.data.icon ?? null,
      category: parsed.data.category ?? null,
      sourceType: parsed.data.sourceType ?? null,
      sourceRef: parsed.data.sourceRef ?? null,
    },
  });

  return NextResponse.json(habit, { status: 201 });
}
