import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ foodId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { foodId } = await params;

  await prisma.favoriteFood.deleteMany({
    where: { userId: session.user.id, foodId },
  });

  return NextResponse.json({ ok: true });
}
