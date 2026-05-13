import { getSession } from '@/lib/session';
import { getCachedProfile, getCachedInsight, getCachedBloodworkMarkers } from '@/lib/data-cache';
import { BloodworkClient } from './BloodworkClient';

export default async function BloodworkPage() {
  const session = await getSession();
  const userId = session!.user.id;

  const [markers, profile, latestInsight] = await Promise.all([
    getCachedBloodworkMarkers(userId),
    getCachedProfile(userId),
    getCachedInsight(userId, 'bloodwork_summary'),
  ]);

  return (
    <BloodworkClient
      initialMarkers={markers}
      profile={profile}
      latestInsight={latestInsight ? { content: latestInsight.content, generatedAt: new Date(latestInsight.generatedAt).toISOString() } : null}
    />
  );
}
