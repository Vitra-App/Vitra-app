import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/bloodwork/log/[date]
//   date is YYYY-MM-DD (UTC). Deletes every BloodworkMarker for the current user
//   whose testedAt falls within that day. Used when removing a full log panel.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);

  const result = await prisma.bloodworkMarker.deleteMany({
    where: {
      userId: session.user.id,
      testedAt: { gte: start, lte: end },
    },
  });

  return NextResponse.json({ count: result.count });
}
