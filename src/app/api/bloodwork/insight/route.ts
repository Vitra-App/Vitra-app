import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateBloodworkSummary } from '@/lib/ai-service';

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  const [markers, profile] = await Promise.all([
    prisma.bloodworkMarker.findMany({ where: { userId }, orderBy: { markerName: 'asc' } }),
    prisma.userProfile.findUnique({ where: { userId }, select: { sex: true, goal: true } }),
  ]);

  const content = await generateBloodworkSummary(profile, markers);

  const insight = await prisma.aIInsight.create({
    data: { userId, insightType: 'bloodwork_summary', content },
  });

  return NextResponse.json({ content: insight.content, generatedAt: insight.generatedAt.toISOString() });
}
