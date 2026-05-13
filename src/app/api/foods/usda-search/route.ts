import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasUsdaKey, searchUsdaFoods } from '@/lib/usda';

// GET /api/foods/usda-search?q=...
// Returns USDA results without persisting them. Returns [] if USDA_API_KEY is unset.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ enabled: hasUsdaKey(), results: [] });

  const results = await searchUsdaFoods(q);
  return NextResponse.json({ enabled: hasUsdaKey(), results });
}
