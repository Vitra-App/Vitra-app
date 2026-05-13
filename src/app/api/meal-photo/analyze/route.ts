import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { analyzeMealPhoto } from '@/lib/ai-service';
import { z } from 'zod';

const schema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { base64, mimeType, description } = parsed.data;
  const result = await analyzeMealPhoto(base64, mimeType, description);
  return NextResponse.json(result);
}
