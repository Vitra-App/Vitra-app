import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { bloodworkTag } from '@/lib/data-cache';

const schema = z.object({
  markerName: z.string().min(1).max(100),
  value: z.number(),
  unit: z.string().min(1),
  referenceMin: z.number().nullable().optional(),
  referenceMax: z.number().nullable().optional(),
  testedAt: z.string(),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const markers = await prisma.bloodworkMarker.findMany({
    where: { userId: session.user.id },
    orderBy: [{ markerName: 'asc' }, { testedAt: 'desc' }],
  });

  return NextResponse.json(markers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const marker = await prisma.bloodworkMarker.create({
    data: {
      userId: session.user.id,
      markerName: parsed.data.markerName,
      value: parsed.data.value,
      unit: parsed.data.unit,
      referenceMin: parsed.data.referenceMin ?? null,
      referenceMax: parsed.data.referenceMax ?? null,
      testedAt: new Date(parsed.data.testedAt),
      notes: parsed.data.notes ?? null,
    },
  });

  revalidateTag(bloodworkTag(session.user.id));

  return NextResponse.json(marker, { status: 201 });
}
