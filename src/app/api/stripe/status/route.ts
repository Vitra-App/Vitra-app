import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/stripe/status
// Returns the current user's effective subscription tier ("free" | "pro").
//
// This is the single source of truth the client polls after ANY purchase path —
// both the iOS StoreKit/Apple IAP flow (`/api/iap/verify`) and the web Stripe
// checkout flow write to the same `SubscriptionStatus` row, so this endpoint
// must consider both `platform: "web"` (Stripe) and `platform: "ios"` (Apple)
// records, not just Stripe fields.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sub = await prisma.subscriptionStatus.findUnique({
    where: { userId: session.user.id },
  });

  if (!sub) {
    return NextResponse.json({ tier: 'free' });
  }

  // A row can exist with tier: 'pro' from a past purchase whose period has since
  // elapsed without an intervening webhook/renewal update reaching us — treat an
  // expired currentPeriodEnd as effectively free, regardless of platform.
  const now = new Date();
  const isActive = sub.tier === 'pro' && (!sub.currentPeriodEnd || sub.currentPeriodEnd > now);

  return NextResponse.json({
    tier: isActive ? 'pro' : 'free',
    platform: sub.platform,
    expiresAt: sub.currentPeriodEnd,
  });
}
