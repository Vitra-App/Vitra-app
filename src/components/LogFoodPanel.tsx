'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type MealItem = {
  id: string;
  foodId: string;
  servingCount: number;
  calories: number;
  food: { id: string; name: string };
};

type LoggedMeal = {
  id: string;
  mealType: string;
  mealItems: MealItem[];
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎',
};

function defaultMealForNow() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 19) return 'dinner';
  return 'snack';
}

export function LogFoodPanel() {
  const router = useRouter();
  const [meals, setMeals] = useState<LoggedMeal[]>([]);
  const [loaded, setLoaded] = useState(false);

  function loadMeals() {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/meals?date=${today}`)
      .then((r) => r.json())
      .then((data) => {
        setMeals(Array.isArray(data) ? data : []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }

  useEffect(() => { loadMeals(); }, []);

  async function deleteItem(meal: LoggedMeal, itemId: string) {
    // Optimistically remove from UI immediately
    setMeals((prev) =>
      prev
        .map((m) =>
          m.id !== meal.id
            ? m
            : { ...m, mealItems: m.mealItems.filter((i) => i.id !== itemId) },
        )
        .filter((m) => m.mealItems.length > 0),
    );

    const remaining = meal.mealItems.filter((i) => i.id !== itemId);
    try {
      if (remaining.length === 0) {
        await fetch(`/api/meals/${meal.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/meals/${meal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: remaining.map((i) => ({ foodId: i.foodId, servingCount: i.servingCount })),
          }),
        });
      }
      router.refresh(); // update calorie totals on dashboard
    } catch {
      // On error, reload to restore correct state
      loadMeals();
    }
  }

  // Group by mealType
  const byType: Record<string, LoggedMeal[]> = {};
  for (const m of meals) {
    if (!byType[m.mealType]) byType[m.mealType] = [];
    byType[m.mealType].push(m);
  }

  const suggestedType = defaultMealForNow();

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Log Food</h2>
        <div className="flex items-center gap-3">
          <Link href="/meal-photo" className="text-xs text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1">
            📷 Photo AI
          </Link>
          <Link href="/scan" className="text-xs text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1">
            📦 Scan
          </Link>
        </div>
      </div>

      {/* Meal sections */}
      <div className="space-y-2">
        {MEAL_TYPES.map((type) => {
          const typeMeals = byType[type] ?? [];
          const allItems = typeMeals.flatMap((m) =>
            m.mealItems.map((item) => ({ ...item, mealId: m.id, meal: m })),
          );
          const totalCals = allItems.reduce((s, i) => s + i.calories, 0);
          const isLogged = allItems.length > 0;
          const editMeal = typeMeals[0];

          return (
            <div
              key={type}
              className={`rounded-xl border overflow-hidden transition-colors ${
                isLogged
                  ? 'border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-900/10'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
              }`}
            >
              {/* Meal type header */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
                <span className="text-base leading-none">{MEAL_ICONS[type]}</span>
                <span className={`text-xs font-semibold capitalize flex-1 ${isLogged ? 'text-brand-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {type}
                </span>
                {isLogged && (
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {Math.round(totalCals)} kcal
                  </span>
                )}
              </div>

              {/* Food item rows */}
              {isLogged && (
                <div className="border-t border-brand-100 dark:border-brand-900/40">
                  {allItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 group"
                    >
                      {/* Tap row to edit meal */}
                      <Link
                        href={`/log-food?type=${type}&edit=${item.mealId}`}
                        className="flex-1 min-w-0"
                      >
                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate leading-snug">
                          {item.food.name}
                          {item.servingCount !== 1 && (
                            <span className="ml-1 text-slate-400 dark:text-slate-500">×{item.servingCount}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          {Math.round(item.calories)} kcal
                        </p>
                      </Link>
                      {/* Delete item */}
                      <button
                        onClick={() => deleteItem(item.meal, item.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                        aria-label="Remove item"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add button */}
              <div className="px-3 pb-2.5 pt-2">
                <Link
                  href={`/log-food?type=${type}${isLogged ? `&edit=${editMeal.id}` : ''}`}
                  className={`block w-full text-center text-xs font-medium rounded-lg py-1.5 transition-colors ${
                    isLogged
                      ? 'text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                      : type === suggestedType
                        ? 'bg-brand-500 text-white hover:bg-brand-600'
                        : 'text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                  }`}
                >
                  {isLogged ? '+ Add more' : `+ Log ${type}`}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {!loaded && (
        <div className="py-2 flex justify-center">
          <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

