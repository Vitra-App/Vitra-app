import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const habit = await prisma.habit.findFirst({
    where: { id, userId: session.user.id, isActive: true },
  });
  if (!habit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const checking = body.check === true;

  let newStreak = habit.streak;
  let newLastChecked: string | null = habit.lastCheckedDate;

  if (checking) {
    if (habit.lastCheckedDate === todayStr()) {
      // Already checked today — no-op
      return NextResponse.json(habit);
    }
    // Consecutive if last check was yesterday
    newStreak = habit.lastCheckedDate === yesterdayStr() ? habit.streak + 1 : 1;
    newLastChecked = todayStr();
  } else {
    // Unchecking today
    if (habit.lastCheckedDate === todayStr()) {
      newStreak = Math.max(0, habit.streak - 1);
      newLastChecked = yesterdayStr();
    }
  }

  const updated = await prisma.habit.update({
    where: { id },
    data: { streak: newStreak, lastCheckedDate: newLastChecked },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  await prisma.habit.updateMany({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
