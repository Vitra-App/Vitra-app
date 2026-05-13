import { getSession } from '@/lib/session';
import { Suspense } from 'react';
import {
  getCachedProfile,
  getCachedSubStatus,
  getCachedInsight,
} from '@/lib/data-cache';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { MacroRing } from '@/components/ui/MacroRing';
import { AIInsightCard } from '@/components/ui/AIInsightCard';
import { DailyScoreCard } from '@/components/ui/DailyScoreCard';
import { LogFoodPanel } from '@/components/LogFoodPanel';
import { DayNav } from '@/components/ui/DayNav';
import { NutritionGuidance } from '@/components/ui/NutritionGuidance';
import { TrendCard } from '@/components/ui/TrendCard';
import { HabitsCard } from '@/components/ui/HabitsCard';

import { calcDailyScore } from '@/lib/nutrition';
import Link from 'next/link';

function todayMidnightUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseDateParam(param: string | undefined): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const d = new Date(param + 'T00:00:00.000Z');
    if (!isNaN(d.getTime())) return d;
  }
  return todayMidnightUTC();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const session = await getSession();
  const userId = session!.user.id;
  const today = todayMidnightUTC();
  const selectedDate = parseDateParam(dateParam);
  const isToday = selectedDate.getTime() === today.getTime();
  const dateStr = selectedDate.toISOString().slice(0, 10);

  const dayEnd = new Date(selectedDate);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

  const [profile, todaySummary, recentMeals, latestInsight, subStatus, trendDays] = await Promise.all([
    getCachedProfile(userId),
    prisma.dailyNutritionSummary.findFirst({
      where: { userId, date: selectedDate },
      select: {
        calories: true, proteinG: true, carbsG: true, fatG: true,
        fiberG: true, vitaminDMcg: true, ironMg: true, calciumMg: true, sodiumMg: true,
      },
    }),
    prisma.meal.findMany({
      where: { userId, loggedAt: { gte: selectedDate, lt: dayEnd } },
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
    getCachedInsight(userId, 'daily_outlook'),
    getCachedSubStatus(userId),
    isToday
      ? prisma.dailyNutritionSummary.findMany({
          where: { userId, date: { gte: sevenDaysAgo, lte: today } },
          orderBy: { date: 'asc' },
          select: { date: true, calories: true, proteinG: true, fiberG: true, sodiumMg: true },
        })
      : Promise.resolve([]),
  ]);

  const summary = todaySummary ?? {
    calories: 0, proteinG: 0, carbsG: 0, fatG: 0,
    fiberG: 0, vitaminDMcg: 0, ironMg: 0, calciumMg: 0,
    sodiumMg: 0,
  };

  const targets = {
    calories: profile?.caloricTarget ?? 2000,
    protein: profile?.proteinTargetG ?? 120,
    carbs: profile?.carbTargetG ?? 250,
    fat: profile?.fatTargetG ?? 65,
    fiber: 30,
  };

  const isPro = subStatus?.tier === 'pro';

  const dailyScore = calcDailyScore(
    {
      calories: summary.calories,
      proteinG: summary.proteinG,
      carbsG: summary.carbsG,
      fatG: summary.fatG,
      fiberG: summary.fiberG,
      sodiumMg: summary.sodiumMg,
    },
    {
      calories: targets.calories,
      proteinG: targets.protein,
      carbsG: targets.carbs,
      fatG: targets.fat,
    },
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <DayNav dateStr={dateStr} isToday={isToday} />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isToday ? `Good ${greeting()}, ${session!.user.name?.split(' ')[0] ?? 'there'} 👋` : selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
        </h1>
      </div>

      {/* Log food panel — only for today */}
      {isToday && (
        <Suspense fallback={null}>
          <LogFoodPanel />
        </Suspense>
      )}

      {/* What to eat next — today only, minimal mode shows this */}
      {isToday && (
        <NutritionGuidance summary={summary} targets={targets} />
      )}

      {/* Daily diet score */}
      <DailyScoreCard result={dailyScore} />

      {/* Calorie card */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Calories {isToday ? 'Today' : 'That Day'}</p>
            <p className="text-4xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {Math.round(summary.calories)}
              <span className="text-lg font-normal text-slate-400 dark:text-slate-500"> / {targets.calories}</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {Math.max(0, targets.calories - Math.round(summary.calories))} kcal remaining
            </p>
          </div>
          <MacroRing
            calories={summary.calories}
            proteinG={summary.proteinG}
            carbsG={summary.carbsG}
            fatG={summary.fatG}
          />
        </div>
      </div>

      {/* Macro progress */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Macros</h2>
        <ProgressBar label="Protein" value={summary.proteinG} max={targets.protein} color="bg-green-500" unit="g" />
        <ProgressBar label="Carbs" value={summary.carbsG} max={targets.carbs} color="bg-blue-500" unit="g" />
        <ProgressBar label="Fat" value={summary.fatG} max={targets.fat} color="bg-amber-500" unit="g" />
        <ProgressBar label="Fiber" value={summary.fiberG} max={targets.fiber} color="bg-purple-500" unit="g" />
      </div>

      {/* Micronutrients */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Key Micronutrients</h2>
        <ProgressBar label="Vitamin D" value={summary.vitaminDMcg} max={20} color="bg-yellow-400" unit="mcg" />
        <ProgressBar label="Calcium" value={summary.calciumMg} max={1000} color="bg-sky-400" unit="mg" />
        <ProgressBar label="Iron" value={summary.ironMg} max={18} color="bg-red-400" unit="mg" />
        <ProgressBar label="Sodium" value={summary.sodiumMg} max={2300} color="bg-slate-400" unit="mg" />
      </div>

      {/* 7-day trend intelligence */}
      <TrendCard
        days={trendDays.map((d) => ({
          date: d.date.toISOString().slice(0, 10),
          calories: d.calories,
          proteinG: d.proteinG,
          fiberG: d.fiberG,
          sodiumMg: d.sodiumMg,
        }))}
        targets={{ calories: targets.calories, protein: targets.protein, fiber: targets.fiber }}
      />

      {/* Habits — today only */}
      {isToday && <HabitsCard />}

      {/* AI Insight */}
      {isPro ? (
        <div>
          {latestInsight ? (
            <AIInsightCard content={latestInsight.content} generatedAt={latestInsight.generatedAt} />
          ) : (
            <div className="card text-center py-8">
              <p className="text-sm text-slate-500 dark:text-slate-400 text-sm">No AI insight yet today.</p>
              <Link href="/dashboard/generate-insight" className="btn-primary mt-4 inline-flex">
                ✨ Generate Today&apos;s Outlook
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-800 border-brand-100 dark:border-brand-800/50 text-center py-6">
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400 mb-1">✨ AI Outlooks — Pro Feature</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Upgrade to Pro to get personalised daily AI nutrition insights.</p>
          <button className="btn-primary mt-4 opacity-60 cursor-not-allowed" disabled>Coming Soon</button>
        </div>
      )}

      {/* Recent meals */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{isToday ? "Today's" : "Day's"} Meals</h2>
        </div>

        {recentMeals.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No meals logged {isToday ? 'yet today' : 'on this day'}.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {recentMeals.map((meal) => {
              const mealCals = meal.mealItems.reduce((s, i) => s + i.calories, 0);
              return (
                <li key={meal.id}>
                  <Link
                    href={`/log-food?type=${meal.mealType}&edit=${meal.id}`}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">{meal.mealType}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {meal.mealItems.map((i) => i.food.name).slice(0, 3).join(', ')}
                        {meal.mealItems.length > 3 ? ` +${meal.mealItems.length - 3} more` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{Math.round(mealCals)} kcal</span>
                      <svg className="text-slate-300 dark:text-slate-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
