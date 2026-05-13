import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';

// Tell Next.js NOT to parse the body — Stripe needs the raw bytes to verify the signature
export const config = { api: { bodyParser: false } };

// POST /api/stripe/webhook  ->  handle Stripe events
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Stripe not configured.' }, { status: 503 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 503 });

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const isActive = sub.status === 'active' || sub.status === 'trialing';
      // current_period_end may be at subscription level or items level depending on API version
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const periodEnd = (sub as any).current_period_end as number | undefined;
      await prisma.subscriptionStatus.upsert({
        where: { userId },
        update: {
          tier: isActive ? 'pro' : 'free',
          stripeSubId: sub.id,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
        create: {
          userId,
          tier: isActive ? 'pro' : 'free',
          stripeSubId: sub.id,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      await prisma.subscriptionStatus.updateMany({
        where: { userId },
        data: { tier: 'free', stripeSubId: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
      });
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userId = session.metadata?.userId ?? (session as any).subscription_data?.metadata?.userId;
      const customerId = typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer | null)?.id;
      if (userId && customerId) {
        await prisma.subscriptionStatus.upsert({
          where: { userId },
          update: { stripeCustomerId: customerId },
          create: { userId, tier: 'free', stripeCustomerId: customerId },
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
