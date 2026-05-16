import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function ProgressPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userId = session.user.id;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  const [profile, nutritionRows, weightEntries] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.dailyNutritionSummary.findMany({
      where: { userId, date: { gte: thirtyDaysAgo, lte: today } },
      orderBy: { date: 'asc' },
      select: { date: true, calories: true, proteinG: true, carbsG: true, fatG: true, fiberG: true },
    }),
    prisma.weightEntry.findMany({
      where: { userId, loggedAt: { gte: thirtyDaysAgo } },
      orderBy: { loggedAt: 'asc' },
      select: { weightKg: true, loggedAt: true },
    }),
  ]);

  // Build 30-day arrays
  const days: { date: string; calories: number; proteinG: number; carbsG: number; fatG: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = nutritionRows.find((r) => r.date.toISOString().slice(0, 10) === dateStr);
    days.push({
      date: dateStr,
      calories: found?.calories ?? 0,
      proteinG: found?.proteinG ?? 0,
      carbsG: found?.carbsG ?? 0,
      fatG: found?.fatG ?? 0,
    });
  }

  const calTarget = profile?.caloricTarget ?? 2000;
  const protTarget = profile?.proteinTargetG ?? 120;

  const avgCal = (() => {
    const logged = days.filter((d) => d.calories > 0);
    return logged.length ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : 0;
  })();
  const avgProt = (() => {
    const logged = days.filter((d) => d.proteinG > 0);
    return logged.length ? Math.round(logged.reduce((s, d) => s + d.proteinG, 0) / logged.length) : 0;
  })();
  const daysLogged = days.filter((d) => d.calories > 0).length;

  // SVG bar chart helpers
  const maxCal = Math.max(...days.map((d) => d.calories), calTarget * 1.2);
  const BAR_W = 8;
  const CHART_H = 100;
  const CHART_W = 30 * (BAR_W + 2);

  function calBar(cal: number, idx: number) {
    if (cal <= 0) return null;
    const h = Math.round((cal / maxCal) * CHART_H);
    const x = idx * (BAR_W + 2);
    const y = CHART_H - h;
    const overTarget = cal > calTarget * 1.1;
    const fill = overTarget ? '#f97316' : '#22c55e';
    return <rect key={idx} x={x} y={y} width={BAR_W} height={h} rx={2} fill={fill} />;
  }

  // Weight chart
  const weightPoints = weightEntries.map((e) => ({
    kg: e.weightKg,
    day: Math.round((e.loggedAt.getTime() - thirtyDaysAgo.getTime()) / 86400000),
  }));

  function weightPath() {
    if (weightPoints.length < 2) return '';
    const minW = Math.min(...weightPoints.map((p) => p.kg));
    const maxW = Math.max(...weightPoints.map((p) => p.kg));
    const range = maxW - minW || 2;
    const pts = weightPoints.map((p) => {
      const x = (p.day / 29) * CHART_W;
      const y = CHART_H - ((p.kg - minW) / range) * (CHART_H - 10) - 5;
      return `${x},${y}`;
    });
    return `M ${pts.join(' L ')}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Progress</h1>
        <span className="text-xs text-slate-400 dark:text-slate-500">Last 30 days</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{daysLogged}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Days logged</p>
        </div>
        <div className="card text-center py-3">
          <p className={`text-2xl font-bold ${avgCal > calTarget * 1.1 ? 'text-orange-500' : 'text-slate-900 dark:text-slate-100'}`}>{avgCal}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Avg kcal/day</p>
        </div>
        <div className="card text-center py-3">
          <p className={`text-2xl font-bold ${avgProt < protTarget * 0.8 ? 'text-orange-500' : 'text-slate-900 dark:text-slate-100'}`}>{avgProt}g</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Avg protein</p>
        </div>
      </div>

      {/* Calorie bar chart */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Daily Calories</h2>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />On target</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" />&gt;10% over</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <svg width={CHART_W} height={CHART_H + 20} viewBox={`0 0 ${CHART_W} ${CHART_H + 20}`} className="min-w-full">
            {/* Target line */}
            <line
              x1={0} y1={CHART_H - Math.round((calTarget / maxCal) * CHART_H)}
              x2={CHART_W} y2={CHART_H - Math.round((calTarget / maxCal) * CHART_H)}
              stroke="#22c55e" strokeDasharray="3,3" strokeWidth={1} opacity={0.5}
            />
            {/* Bars */}
            {days.map((d, i) => calBar(d.calories, i))}
            {/* Month labels */}
            {[0, 6, 13, 20, 27].map((i) => (
              <text key={i} x={i * (BAR_W + 2) + BAR_W / 2} y={CHART_H + 14} textAnchor="middle" fontSize={8} fill="#94a3b8">
                {days[i]?.date.slice(5) ?? ''}
              </text>
            ))}
          </svg>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">Dashed line = {calTarget} kcal target</p>
      </div>

      {/* Macro split */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">30-Day Macro Averages</h2>
        {daysLogged === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No data yet. Start logging meals!</p>
        ) : (
          <div className="space-y-2">
            {[
              { label: 'Protein', avg: avgProt, target: protTarget, unit: 'g', color: 'bg-blue-500' },
              { label: 'Carbs', avg: Math.round(days.filter(d => d.carbsG > 0).reduce((s, d) => s + d.carbsG, 0) / (days.filter(d => d.carbsG > 0).length || 1)), target: profile?.carbTargetG ?? 250, unit: 'g', color: 'bg-yellow-500' },
              { label: 'Fat', avg: Math.round(days.filter(d => d.fatG > 0).reduce((s, d) => s + d.fatG, 0) / (days.filter(d => d.fatG > 0).length || 1)), target: profile?.fatTargetG ?? 65, unit: 'g', color: 'bg-red-400' },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>{m.label}</span>
                  <span>{m.avg}{m.unit} <span className="text-slate-400">/ {Math.round(m.target)}{m.unit}</span></span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.color}`}
                    style={{ width: `${Math.min(100, (m.avg / (m.target || 1)) * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weight trend */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Weight Trend</h2>
          <Link href="/dashboard" className="text-xs text-brand-600 dark:text-brand-400">
            Log weight ↗
          </Link>
        </div>
        {weightPoints.length < 2 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Log your weight from the dashboard to see your trend here.
          </p>
        ) : (
          <>
            <svg width={CHART_W} height={CHART_H + 20} viewBox={`0 0 ${CHART_W} ${CHART_H + 20}`} className="w-full">
              <path d={weightPath()} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinejoin="round" />
              {weightPoints.map((p, i) => {
                const minW = Math.min(...weightPoints.map((q) => q.kg));
                const maxW = Math.max(...weightPoints.map((q) => q.kg));
                const range = maxW - minW || 2;
                const x = (p.day / 29) * CHART_W;
                const y = CHART_H - ((p.kg - minW) / range) * (CHART_H - 10) - 5;
                return <circle key={i} cx={x} cy={y} r={3} fill="#22c55e" />;
              })}
            </svg>
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500">
              <span>Start: {weightPoints[0].kg.toFixed(1)} kg</span>
              <span>Latest: {weightPoints[weightPoints.length - 1].kg.toFixed(1)} kg</span>
              {weightPoints.length >= 2 && (
                <span className={weightPoints[weightPoints.length - 1].kg < weightPoints[0].kg ? 'text-green-500' : 'text-orange-500'}>
                  {(weightPoints[weightPoints.length - 1].kg - weightPoints[0].kg > 0 ? '+' : '')}
                  {(weightPoints[weightPoints.length - 1].kg - weightPoints[0].kg).toFixed(1)} kg
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
