import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { verifySignedTransaction, isProProductId } from '@/lib/apple-iap';

// POST /api/iap/verify
// Body: { signedTransaction: string }  — the base64 JWS from `Transaction.jwsRepresentation`
// Verifies the transaction was genuinely issued by Apple for this app, then grants/updates
// the user's Pro entitlement. This is the iOS purchase path (StoreKit2) — separate from the
// Stripe web checkout flow, per App Store Guideline 3.1.1.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let signedTransaction: string | undefined;
  try {
    const body = await req.json();
    signedTransaction = body?.signedTransaction;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!signedTransaction || typeof signedTransaction !== 'string') {
    return NextResponse.json({ error: 'Missing signedTransaction' }, { status: 400 });
  }

  let tx;
  try {
    tx = await verifySignedTransaction(signedTransaction);
  } catch (err) {
    console.error('[iap/verify] Signature verification failed:', err);
    return NextResponse.json({ error: 'Could not verify purchase with Apple.' }, { status: 400 });
  }

  if (tx.revocationDate) {
    return NextResponse.json({ error: 'This purchase was refunded or revoked.' }, { status: 400 });
  }
  if (!isProProductId(tx.productId)) {
    return NextResponse.json({ error: 'Unrecognized product.' }, { status: 400 });
  }

  const now = new Date();
  const isActive = !tx.expiresDate || tx.expiresDate > now;
  const userId = session.user.id;

  // Guard against one Apple account's subscription being attached to multiple Vitra accounts.
  const existingForTransaction = await prisma.subscriptionStatus.findUnique({
    where: { appleOriginalTransactionId: tx.originalTransactionId },
  });
  if (existingForTransaction && existingForTransaction.userId !== userId) {
    return NextResponse.json(
      { error: 'This subscription is already linked to a different account.' },
      { status: 409 }
    );
  }

  const sub = await prisma.subscriptionStatus.upsert({
    where: { userId },
    update: {
      tier: isActive ? 'pro' : 'free',
      platform: 'ios',
      appleOriginalTransactionId: tx.originalTransactionId,
      appleProductId: tx.productId,
      currentPeriodEnd: tx.expiresDate,
      cancelAtPeriodEnd: false,
    },
    create: {
      userId,
      tier: isActive ? 'pro' : 'free',
      platform: 'ios',
      appleOriginalTransactionId: tx.originalTransactionId,
      appleProductId: tx.productId,
      currentPeriodEnd: tx.expiresDate,
    },
  });

  return NextResponse.json({ tier: sub.tier, expiresAt: sub.currentPeriodEnd });
}
