'use client';

const FOOD_SUGGESTIONS: Record<string, string> = {
  protein: 'eggs, Greek yogurt, chicken, cottage cheese',
  fiber: 'beans, broccoli, oats, chia seeds',
  fat: 'avocado, nuts, olive oil, salmon',
  carbs: 'oats, sweet potato, brown rice, banana',
  calories: 'a balanced snack or small meal',
};

interface Summary {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

interface Props {
  summary: Summary;
  targets: Targets;
}

export function NutritionGuidance({ summary, targets }: Props) {
  const gaps = [
    {
      key: 'protein',
      label: 'Protein',
      unit: 'g',
      remaining: targets.protein - summary.proteinG,
      target: targets.protein,
    },
    {
      key: 'fiber',
      label: 'Fiber',
      unit: 'g',
      remaining: targets.fiber - summary.fiberG,
      target: targets.fiber,
    },
    {
      key: 'calories',
      label: 'Calories',
      unit: 'kcal',
      remaining: targets.calories - summary.calories,
      target: targets.calories,
    },
  ].filter((g) => g.remaining > g.target * 0.12 && g.remaining > 0);

  // Check if anything is over target (warn)
  const over = [
    { label: 'calories', val: summary.calories, max: targets.calories },
    { label: 'fat', val: summary.fatG, max: targets.fat },
    { label: 'carbs', val: summary.carbsG, max: targets.carbs },
  ].filter((o) => o.val > o.max * 1.1);

  if (gaps.length === 0 && over.length === 0) {
    return (
      <div className="card bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          ✓ All targets hit for today — great work!
        </p>
      </div>
    );
  }

  const primary = gaps[0];

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">What to eat next</h2>

      <div className="flex flex-wrap gap-2">
        {gaps.slice(0, 3).map((g) => (
          <span
            key={g.key}
            className="inline-flex items-center gap-1 text-xs bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400 px-2.5 py-1 rounded-full font-medium border border-brand-100 dark:border-brand-800/30"
          >
            +{Math.round(g.remaining)}
            {g.unit} {g.label}
          </span>
        ))}
        {over.slice(0, 1).map((o) => (
          <span
            key={o.label}
            className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium border border-amber-100 dark:border-amber-800/30"
          >
            Near {o.label} limit
          </span>
        ))}
      </div>

      {primary && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Focus on{' '}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {primary.label.toLowerCase()}
          </span>
          . Try:{' '}
          <span className="text-slate-600 dark:text-slate-400">
            {FOOD_SUGGESTIONS[primary.key]}
          </span>
        </p>
      )}
    </div>
  );
}
