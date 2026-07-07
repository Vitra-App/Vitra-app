import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { analyzeMealPhoto } from '@/lib/ai-service';
import { groundAnalysisInDatabase } from '@/lib/food-grounding';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

// Words we ignore when hunting for a brand/product in the description.
const STOPWORDS = new Set([
  'the','a','an','and','or','with','of','my','some','this','that','i','ate','had',
  'for','from','on','in','to','plus','grilled','baked','fried','roasted','raw',
  'cooked','fresh','breakfast','lunch','dinner','snack','meal','plate','bowl',
]);

/**
 * Look up branded products the user named in their description so the AI can
 * use real database nutrition values (e.g. "Bell & Evans chicken").
 */
async function findReferenceFoods(description?: string) {
  if (!description) return [];
  const cleaned = description.replace(/[^\p{L}\p{N}&'\s-]/gu, ' ').trim();
  if (cleaned.length < 3) return [];

  const tokens = cleaned
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()));
  if (tokens.length === 0) return [];

  // Build candidate phrases: the full description + individual significant words
  const phrases = Array.from(new Set([cleaned, ...tokens]));

  const results = await prisma.food.findMany({
    where: {
      NOT: { source: 'ai' },
      OR: phrases.flatMap((p) => [
        { brand: { contains: p, mode: 'insensitive' as const } },
        { name: { contains: p, mode: 'insensitive' as const } },
      ]),
    },
    select: {
      name: true, brand: true, servingSize: true, calories: true,
      proteinG: true, carbsG: true, fatG: true, fiberG: true, sugarG: true, sodiumMg: true,
    },
    take: 8,
  });

  // Prefer branded matches first
  return results.sort((a, b) => (b.brand ? 1 : 0) - (a.brand ? 1 : 0));
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
