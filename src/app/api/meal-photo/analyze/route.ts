import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { analyzeMealPhoto } from '@/lib/ai-service';
import { groundAnalysisInDatabase, extractBrandPhrases } from '@/lib/food-grounding';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Look up branded products the user actually named in their description (e.g.
 * "Bell & Evans chicken") so the AI can use real database nutrition values.
 *
 * Only matches genuine 2-3 word brand-like phrases against the `brand` column
 * -- NOT single generic words against `name`. See the identical comment in
 * analyze-text/route.ts for the reproduced failure this fixes (a generic word
 * like "meatballs" matching an unrelated product's name and getting treated
 * as if the user had specifically named that brand).
 */
async function findReferenceFoods(description?: string) {
  if (!description) return [];
  const cleaned = description.replace(/[^\p{L}\p{N}&'\s-]/gu, ' ').trim();
  if (cleaned.length < 4) return [];

  const phrases = extractBrandPhrases(cleaned);
  if (phrases.length === 0) return [];

  const results = await prisma.food.findMany({
    where: {
      NOT: { source: 'ai' },
      OR: phrases.map((p) => ({ brand: { contains: p, mode: 'insensitive' as const } })),
    },
    select: {
      name: true, brand: true, servingSize: true, calories: true,
      proteinG: true, carbsG: true, fatG: true, fiberG: true, sugarG: true, sodiumMg: true,
    },
    take: 8,
  });

  return results;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 10 AI photo analyses per hour per user
  const rl = rateLimit(`analyze:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil(rl.retryAfterMs / 60000)} min.` },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });

  const { base64, mimeType, description } = parsed.data;
  const referenceFoods = await findReferenceFoods(description);
  try {
    const raw = await analyzeMealPhoto(base64, mimeType, description, referenceFoods);
    const result = await groundAnalysisInDatabase(raw);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[meal-photo/analyze] AI analysis failed:', err);
    return NextResponse.json(
      { error: 'The AI service is temporarily unavailable. Please try again in a moment.' },
      { status: 502 },
    );
  }
}
