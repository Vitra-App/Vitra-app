'use client';

interface DaySummary {
  date: string;
  calories: number;
  proteinG: number;
  fiberG: number;
  sodiumMg: number;
}

interface Props {
  days: DaySummary[];
  targets: { calories: number; protein: number; fiber: number };
}

function computeInsights(days: DaySummary[], targets: Props['targets']): string[] {
  if (days.length < 3) return [];
  const insights: string[] = [];

  // Calorie trend: compare last 3 days vs first 3 days
  if (days.length >= 5) {
    const recent = days.slice(-3);
    const earlier = days.slice(0, 3);
    const recentAvg = recent.reduce((s, d) => s + d.calories, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, d) => s + d.calories, 0) / earlier.length;
    const diff = recentAvg - earlierAvg;
    if (diff > 120) {
      insights.push(
        `Your calorie intake has been creeping up — avg +${Math.round(diff)} kcal over the past few days.`,
      );
    } else if (diff < -120) {
      insights.push(
        `Calorie intake down ~${Math.round(Math.abs(diff))} kcal vs earlier this week — great discipline!`,
      );
    }
  }

  // Protein adherence
  const proteinHitDays = days.filter((d) => d.proteinG >= targets.protein * 0.8).length;
  if (proteinHitDays < days.length * 0.5) {
    insights.push(
      `Protein has been consistently below target — only hitting it ${proteinHitDays}/${days.length} days. Aim for ${targets.protein}g daily.`,
    );
  }

  // Fiber average
  const fiberAvg = days.reduce((s, d) => s + d.fiberG, 0) / days.length;
  if (fiberAvg < targets.fiber * 0.65) {
    insights.push(
      `Fiber is averaging ${Math.round(fiberAvg)}g/day — target is ${targets.fiber}g. Add more vegetables, beans, or oats.`,
    );
  }

  // Sodium
  const sodiumAvg = days.reduce((s, d) => s + d.sodiumMg, 0) / days.length;
  if (sodiumAvg > 2800) {
    insights.push(
      `Average sodium is ${Math.round(sodiumAvg)}mg/day — above the 2,300mg limit. Watch processed foods and added salt.`,
    );
  }

  return insights.slice(0, 3);
}

export function TrendCard({ days, targets }: Props) {
  const insights = computeInsights(days, targets);
  if (insights.length === 0) return null;

  return (
    <div className="card space-y-2.5">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">7-Day Trends</h2>
      <ul className="space-y-2">
        {insights.map((insight, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="text-brand-500 mt-0.5 shrink-0 font-bold">→</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
