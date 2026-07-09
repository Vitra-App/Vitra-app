import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { analyzeMealText } from '@/lib/ai-service';
import { groundAnalysisInDatabase, extractBrandPhrases, stripUnmentionedBrandNames } from '@/lib/food-grounding';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({
  description: z.string().min(2),
});

/**
 * Look up branded products the user actually named in their description (e.g.
 * "Bell & Evans chicken") so the AI can use real database nutrition values.
 *
 * Only matches genuine 2-3 word brand-like phrases against the `brand` column
 * -- NOT single generic words against `name`. Matching single words like
 * "meatballs" or "spaghetti" against product names previously caused the AI to
 * be told "the user named this exact brand" for things they never mentioned
 * (e.g. a plain "3 meatballs" got silently treated as "Hip Chick Farms Baked
 * Chicken Meatballs" because that unrelated product's name happened to contain
 * the word "meatballs"). A real brand name is always 2+ words, so requiring
 * that eliminates this entire class of false-positive brand injection.
 */
async function findReferenceFoods(description: string) {
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

  // Shares the same hourly bucket as photo analysis so users can't bypass the rate limit
  // by switching between text and photo mode.
  const rl = rateLimit(`analyze:${session.user.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${Math.ceil(rl.retryAfterMs / 60000)} min.` },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Please describe what you ate.' }, { status: 400 });

  const { description } = parsed.data;
  const referenceFoods = await findReferenceFoods(description);
  try {
    const raw = await analyzeMealText(description, referenceFoods);
    // Safety net: strip any brand name the model invented on its own that the
    // user never actually mentioned (prompt instructions alone did not
    // reliably stop this -- see stripUnmentionedBrandNames for detail).
    const cleaned = await stripUnmentionedBrandNames(raw, description);
    const result = await groundAnalysisInDatabase(cleaned);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[meal-photo/analyze-text] AI analysis failed:', err);
    return NextResponse.json(
      { error: 'The AI service is temporarily unavailable. Please try again in a moment.' },
      { status: 502 },
    );
  }
}
