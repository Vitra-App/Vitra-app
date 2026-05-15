'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type MealItem = {
  id: string;
  foodId: string;
  servingCount: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  saturatedFatG: number | null;
  potassiumMg: number | null;
  vitaminDMcg: number | null;
  calciumMg: number | null;
  ironMg: number | null;
  food: { id: string; name: string; brand: string | null; servingSize: string };
};

type LoggedMeal = {
  id: string;
  mealType: string;
  mealItems: MealItem[];
};

type RichItem = MealItem & { mealId: string; meal: LoggedMeal };

// FDA daily reference values
const DRV = {
  fiberG: 28, sugarG: 50, sodiumMg: 2300, cholesterolMg: 300,
  saturatedFatG: 20, potassiumMg: 4700, vitaminDMcg: 20, calciumMg: 1300, ironMg: 18,
};
const MICRO_ROWS: { key: keyof typeof DRV; label: string; unit: string; color: string }[] = [
  { key: 'fiberG',       label: 'Fiber',         unit: 'g',   color: 'bg-emerald-500' },
  { key: 'sugarG',       label: 'Sugar',         unit: 'g',   color: 'bg-pink-500' },
  { key: 'sodiumMg',     label: 'Sodium',        unit: 'mg',  color: 'bg-yellow-500' },
  { key: 'cholesterolMg',label: 'Cholesterol',   unit: 'mg',  color: 'bg-orange-500' },
  { key: 'saturatedFatG',label: 'Saturated fat', unit: 'g',   color: 'bg-red-500' },
  { key: 'potassiumMg',  label: 'Potassium',     unit: 'mg',  color: 'bg-violet-500' },
  { key: 'vitaminDMcg',  label: 'Vitamin D',     unit: 'mcg', color: 'bg-amber-500' },
  { key: 'calciumMg',    label: 'Calcium',       unit: 'mg',  color: 'bg-sky-500' },
  { key: 'ironMg',       label: 'Iron',          unit: 'mg',  color: 'bg-rose-600' },
];

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
  const [detailItem, setDetailItem] = useState<RichItem | null>(null);
  const [detailCount, setDetailCount] = useState(1);
  const [saving, setSaving] = useState(false);

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

  async function saveItemServing(item: RichItem, newCount: number) {
    setSaving(true);
    const allItems = item.meal.mealItems.map((i) => ({
      foodId: i.foodId,
      servingCount: i.id === item.id ? newCount : i.servingCount,
    }));
    try {
      await fetch(`/api/meals/${item.mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: allItems }),
      });
      setDetailItem(null);
      loadMeals();
      router.refresh();
    } catch {
      loadMeals();
    } finally {
      setSaving(false);
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
                      {/* Tap row to open detail sheet */}
                      <button
                        onClick={() => { setDetailItem(item); setDetailCount(item.servingCount); }}
                        className="flex-1 min-w-0 text-left"
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
                      </button>
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

      {/* Food detail sheet */}
      {detailItem && (() => {
        const item = detailItem;
        const scale = detailCount / item.servingCount;
        const cal  = Math.round(item.calories      * scale);
        const pro  = (item.proteinG  * scale).toFixed(1);
        const carb = (item.carbsG    * scale).toFixed(1);
        const fat  = (item.fatG      * scale).toFixed(1);

        return (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
            onClick={() => setDetailItem(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-t-2xl px-5 pt-5 pb-8 space-y-5 shadow-2xl max-w-[430px] mx-auto w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">{item.food.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {item.food.brand ? `${item.food.brand} · ` : ''}{item.food.servingSize} per serving
                  </p>
                </div>
                <button onClick={() => setDetailItem(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">×</button>
              </div>

              {/* Stepper */}
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setDetailCount((c) => Math.max(0.5, Math.round((c - 0.5) * 2) / 2))}
                  className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xl font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >−</button>
                <div className="text-center w-20">
                  <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{detailCount}</span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">servings</p>
                </div>
                <button
                  onClick={() => setDetailCount((c) => Math.round((c + 0.5) * 2) / 2)}
                  className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xl font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >+</button>
              </div>

              {/* Macros */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 flex justify-between text-center">
                <div>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{cal}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">kcal</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{pro}g</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">protein</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{carb}g</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">carbs</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fat}g</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">fat</p>
                </div>
              </div>

              {/* Micronutrients */}
              {MICRO_ROWS.some((r) => item[r.key] != null) && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Micronutrients · % Daily Value</p>
                  {MICRO_ROWS.filter((r) => item[r.key] != null).map(({ key, label, unit, color }) => {
                    const raw = (item[key] as number) * scale;
                    const pct = Math.min(100, Math.round((raw / DRV[key]) * 100));
                    const display = unit === 'mg' ? Math.round(raw) : raw < 10 ? raw.toFixed(1) : Math.round(raw);
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
                          <span>{label}</span>
                          <span className="text-slate-400">{display}{unit} <span className="font-semibold text-slate-600 dark:text-slate-200">{pct}%</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { deleteItem(item.meal, item.id); setDetailItem(null); }}
                  className="btn-secondary flex-none px-4 py-2.5 text-sm text-red-500 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
                <button
                  onClick={() => saveItemServing(item, detailCount)}
                  disabled={saving || detailCount === item.servingCount}
                  className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving…' : detailCount === item.servingCount ? 'No changes' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

