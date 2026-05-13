import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const markerSchema = z.object({
  markerName: z.string().min(1).max(100),
  value: z.number(),
  unit: z.string().min(1),
  referenceMin: z.number().nullable().optional(),
  referenceMax: z.number().nullable().optional(),
  notes: z.string().optional(),
});

const schema = z.object({
  testedAt: z.string().min(1),
  markers: z.array(markerSchema).min(1),
});

// POST /api/bloodwork/batch
//   { testedAt: '2026-05-04', markers: [{ markerName, value, unit, ... }, ...] }
// Creates one BloodworkMarker row per item (one full "log panel" at a single date).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', issues: parsed.error.issues }, { status: 400 });
  }

  const testedAt = new Date(parsed.data.testedAt);
  const userId = session.user.id;

  const created = await prisma.$transaction(
    parsed.data.markers.map((m) =>
      prisma.bloodworkMarker.create({
        data: {
          userId,
          markerName: m.markerName,
          value: m.value,
          unit: m.unit,
          referenceMin: m.referenceMin ?? null,
          referenceMax: m.referenceMax ?? null,
          testedAt,
          notes: m.notes ?? null,
        },
      }),
    ),
  );

  return NextResponse.json({ count: created.length, markers: created }, { status: 201 });
}
