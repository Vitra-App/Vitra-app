import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getCachedSubStatus } from '@/lib/data-cache';
import { hasStripe } from '@/lib/stripe';
import { Suspense } from 'react';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const session = await getSession();
  const userId = session!.user.id;

  const [user, profile, subStatus] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, image: true } }),
    prisma.userProfile.findUnique({ where: { userId } }),
    getCachedSubStatus(userId),
  ]);

  return (
    <Suspense fallback={null}>
      <SettingsClient
        user={user ?? { name: session!.user.name ?? null, email: session!.user.email ?? null, image: null }}
        profile={profile}
        tier={subStatus?.tier ?? 'free'}
        stripeEnabled={hasStripe()}
      />
    </Suspense>
  );
}
