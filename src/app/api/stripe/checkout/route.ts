import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

// POST /api/stripe/checkout  ->  create a Stripe Checkout session for Pro
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 503 });
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: 'No price configured.' }, { status: 503 });
  }

  const userId = session.user.id;
  const email = session.user.email ?? undefined;

  // Fetch or create a Stripe customer
  let sub = await prisma.subscriptionStatus.findUnique({ where: { userId } });
  let customerId = sub?.stripeCustomerId ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId } });
    customerId = customer.id;
    await prisma.subscriptionStatus.upsert({
      where: { userId },
      update: { stripeCustomerId: customerId },
      create: { userId, tier: 'free', stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/settings?upgraded=1`,
    cancel_url: `${process.env.NEXTAUTH_URL}/settings`,
    subscription_data: { metadata: { userId } },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
