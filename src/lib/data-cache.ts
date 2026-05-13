import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ─── Cache tags ───────────────────────────────────────────────────────────────
export const profileTag = (userId: string) => `profile-${userId}`;
export const subTag = (userId: string) => `sub-${userId}`;
export const insightTag = (userId: string) => `insights-${userId}`;
export const dailyTag = (userId: string, date: string) => `daily-${userId}-${date}`;

// ─── User profile ─────────────────────────────────────────────────────────────
export function getCachedProfile(userId: string) {
  return unstable_cache(
    () =>
      prisma.userProfile.findUnique({
        where: { userId },
        select: {
          caloricTarget: true,
          proteinTargetG: true,
          carbTargetG: true,
          fatTargetG: true,
          sex: true,
          goal: true,
        },
      }),
    [profileTag(userId)],
    { tags: [profileTag(userId)], revalidate: 3600 },
  )();
}

// ─── Subscription status ──────────────────────────────────────────────────────
export function getCachedSubStatus(userId: string) {
  return unstable_cache(
    () =>
      prisma.subscriptionStatus.findUnique({
        where: { userId },
        select: { tier: true },
      }),
    [subTag(userId)],
    { tags: [subTag(userId)], revalidate: 3600 },
  )();
}

// ─── Latest AI insight by type ────────────────────────────────────────────────
export function getCachedInsight(userId: string, insightType: string) {
  return unstable_cache(
    () =>
      prisma.aIInsight.findFirst({
        where: { userId, insightType },
        orderBy: { generatedAt: 'desc' },
        select: { content: true, generatedAt: true },
      }),
    [insightTag(userId), insightType],
    { tags: [insightTag(userId)], revalidate: 300 },
  )();
}

// ─── Daily nutrition summary ──────────────────────────────────────────────────
export function getCachedDailySummary(userId: string, date: Date) {
  const dateStr = date.toISOString().slice(0, 10);
  return unstable_cache(
    () =>
      prisma.dailyNutritionSummary.findFirst({
        where: { userId, date },
        select: {
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
          fiberG: true,
          vitaminDMcg: true,
          ironMg: true,
          calciumMg: true,
          sodiumMg: true,
        },
      }),
    [dailyTag(userId, dateStr)],
    { tags: [dailyTag(userId, dateStr)], revalidate: 60 },
  )();
}

// ─── Recent meals for a specific day ────────────────────────────────────────
export function getCachedRecentMeals(userId: string, since: Date) {
  const dateStr = since.toISOString().slice(0, 10);
  const dayStart = new Date(since);
  const dayEnd = new Date(since);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  return unstable_cache(
    () =>
      prisma.meal.findMany({
        where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { loggedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          mealType: true,
          mealItems: {
            select: {
              calories: true,
              food: { select: { name: true } },
            },
          },
        },
      }),
    [dailyTag(userId, dateStr), 'meals'],
    { tags: [dailyTag(userId, dateStr)], revalidate: 60 },
  )();
}

// ─── Bloodwork markers ────────────────────────────────────────────────────────
export const bloodworkTag = (userId: string) => `bloodwork-${userId}`;

export function getCachedBloodworkMarkers(userId: string) {
  return unstable_cache(
    () =>
      prisma.bloodworkMarker.findMany({
        where: { userId },
        orderBy: [{ markerName: 'asc' }, { testedAt: 'desc' }],
      }),
    [bloodworkTag(userId)],
    { tags: [bloodworkTag(userId)], revalidate: 300 },
  )();
}
