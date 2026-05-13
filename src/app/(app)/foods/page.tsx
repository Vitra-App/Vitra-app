'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Food = {
  id: string;
  name: string;
  brand: string | null;
  servingSize: string;
  servingWeightG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
  isCustom: boolean;
  source: string | null;
};

type SearchFood = {
  id: string;
  name: string;
  brand: string | null;
  servingSize: string;
  servingWeightG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
};

type UsdaResult = {
  source: 'usda';
  externalId: string;
  name: string;
  brand: string | null;
  servingSize: string;
  servingWeightG: number;
  densityGPerMl: number | null;
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
};

type Ingredient = {
  food: SearchFood;
  servingCount: number;
};

type FormState = {
  name: string;
  brand: string;
  servingSize: string;
  servingWeightG: string;
  densityGPerMl: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  sugarG: string;
  sodiumMg: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  brand: '',
  servingSize: '1 serving',
  servingWeightG: '100',
  densityGPerMl: '',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  fiberG: '',
  sugarG: '',
  sodiumMg: '',
};

type Tab = 'custom' | 'meals' | 'favorites';

export default function FoodsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('custom');
  const [customFoods, setCustomFoods] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create Meal state
  const ingredientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealServing, setMealServing] = useState('1 meal');
  const [mealIngredients, setMealIngredients] = useState<Ingredient[]>([]);
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [ingredientResults, setIngredientResults] = useState<SearchFood[]>([]);
  const [ingredientUsdaResults, setIngredientUsdaResults] = useState<UsdaResult[]>([]);
  const [ingredientSearching, setIngredientSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [mealSaving, setMealSaving] = useState(false);
  const [mealError, setMealError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    const [cRes, fRes] = await Promise.all([
      fetch('/api/foods/mine'),
      fetch('/api/foods/favorites'),
    ]);
    if (cRes.ok) setCustomFoods(await cRes.json());
    if (fRes.ok) setFavorites(await fRes.json());
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/foods/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to create food.');
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCustom(id: string) {
    if (!confirm('Delete this custom food?')) return;
    await fetch(`/api/foods/mine/${id}`, { method: 'DELETE' });
    setCustomFoods((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleUnfavorite(foodId: string) {
    await fetch(`/api/foods/favorites/${foodId}`, { method: 'DELETE' });
    setFavorites((prev) => prev.filter((f) => f.id !== foodId));
  }

  function handleIngredientQueryChange(q: string) {
    setIngredientQuery(q);
    if (ingredientTimer.current) clearTimeout(ingredientTimer.current);
    if (!q.trim() || q.length < 2) { setIngredientResults([]); setIngredientUsdaResults([]); return; }
    ingredientTimer.current = setTimeout(async () => {
      setIngredientSearching(true);
      try {
        const [localRes, usdaRes] = await Promise.all([
          fetch(`/api/foods/search?q=${encodeURIComponent(q)}`).then((r) => r.json()),
          fetch(`/api/foods/usda-search?q=${encodeURIComponent(q)}`).then((r) => r.json()),
        ]);
        setIngredientResults(Array.isArray(localRes) ? localRes : []);
        setIngredientUsdaResults(usdaRes?.results ?? []);
      } finally {
        setIngredientSearching(false);
      }
    }, 300);
  }

  async function importUsdaIngredient(food: UsdaResult) {
    setImportingId(food.externalId);
    try {
      const res = await fetch('/api/foods/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(food),
      });
      if (!res.ok) return;
      const created: SearchFood = await res.json();
      addIngredient(created);
    } finally {
      setImportingId(null);
    }
  }

  function addIngredient(food: SearchFood) {
    setMealIngredients((prev) => {
      const existing = prev.find((i) => i.food.id === food.id);
      if (existing) {
        return prev.map((i) => i.food.id === food.id ? { ...i, servingCount: i.servingCount + 1 } : i);
      }
      return [...prev, { food, servingCount: 1 }];
    });
    setIngredientQuery('');
    setIngredientResults([]);
    setIngredientUsdaResults([]);
  }

  function updateIngredientQty(foodId: string, qty: number) {
    if (qty <= 0) {
      setMealIngredients((prev) => prev.filter((i) => i.food.id !== foodId));
    } else {
      setMealIngredients((prev) => prev.map((i) => i.food.id === foodId ? { ...i, servingCount: qty } : i));
    }
  }

  async function handleSaveMeal(e: React.FormEvent) {
    e.preventDefault();
    setMealError(null);
    if (!mealName.trim()) { setMealError('Meal name is required.'); return; }
    if (mealIngredients.length === 0) { setMealError('Add at least one ingredient.'); return; }
    const totals = mealIngredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + ing.food.calories * ing.servingCount,
        proteinG: acc.proteinG + ing.food.proteinG * ing.servingCount,
        carbsG: acc.carbsG + ing.food.carbsG * ing.servingCount,
        fatG: acc.fatG + ing.food.fatG * ing.servingCount,
        fiberG: acc.fiberG + (ing.food.fiberG ?? 0) * ing.servingCount,
        servingWeightG: acc.servingWeightG + ing.food.servingWeightG * ing.servingCount,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, servingWeightG: 0 },
    );
    setMealSaving(true);
    try {
      const res = await fetch('/api/foods/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mealName.trim(),
          servingSize: mealServing || '1 meal',
          servingWeightG: totals.servingWeightG,
          calories: totals.calories,
          proteinG: totals.proteinG,
          carbsG: totals.carbsG,
          fatG: totals.fatG,
          fiberG: totals.fiberG || null,
          source: 'meal',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMealError(body.error || 'Failed to save meal.');
        return;
      }
      setMealName('');
      setMealServing('1 meal');
      setMealIngredients([]);
      setShowMealForm(false);
      await loadData();
    } finally {
      setMealSaving(false);
    }
  }

  const pureCustomFoods = customFoods.filter((f) => f.source !== 'meal');
  const savedMeals = customFoods.filter((f) => f.source === 'meal');

  const mealTotals = mealIngredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.food.calories * ing.servingCount,
      proteinG: acc.proteinG + ing.food.proteinG * ing.servingCount,
      carbsG: acc.carbsG + ing.food.carbsG * ing.servingCount,
      fatG: acc.fatG + ing.food.fatG * ing.servingCount,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Foods</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Your custom foods, saved meals, and starred favorites.
          </p>
        </div>
        {activeTab === 'custom' && (
          <button
            className="btn-primary"
            onClick={() => { setError(null); setShowForm((v) => !v); }}
          >
            {showForm ? 'Cancel' : '+ New Food'}
          </button>
        )}
        {activeTab === 'meals' && (
          <button
            className="btn-primary"
            onClick={() => { setMealError(null); setShowMealForm((v) => !v); }}
          >
            {showMealForm ? 'Cancel' : '+ Create Meal'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 -mt-2">
        {(['custom', 'meals', 'favorites'] as Tab[]).map((tab) => {
          const label = tab === 'favorites' ? '★ Favorites' : tab === 'meals' ? 'Meals' : 'Custom';
          const count = tab === 'custom' ? pureCustomFoods.length : tab === 'meals' ? savedMeals.length : favorites.length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-semibold py-2.5 transition-colors border-b-2 ${
                activeTab === tab
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs font-normal text-slate-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Create form — only on Custom tab */}
      {activeTab === 'custom' && showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">New Custom Food</h2>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name *" required>
              <input className="input" value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </Field>
            <Field label="Brand (optional)">
              <input className="input" value={form.brand} onChange={(e) => setField('brand', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Serving label">
              <input className="input" value={form.servingSize} onChange={(e) => setField('servingSize', e.target.value)} placeholder="1 cup, 1 slice…" />
            </Field>
            <Field label="Serving weight (g) *">
              <input type="number" className="input" min={0} step="0.1" value={form.servingWeightG} onChange={(e) => setField('servingWeightG', e.target.value)} />
            </Field>
            <Field label="Density (g/mL)" hint="optional">
              <input type="number" className="input" min={0} step="0.01" value={form.densityGPerMl} onChange={(e) => setField('densityGPerMl', e.target.value)} />
            </Field>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">
              Nutrition per serving
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Calories"><input type="number" className="input" min={0} step="1" value={form.calories} onChange={(e) => setField('calories', e.target.value)} /></Field>
              <Field label="Protein (g)"><input type="number" className="input" min={0} step="0.1" value={form.proteinG} onChange={(e) => setField('proteinG', e.target.value)} /></Field>
              <Field label="Carbs (g)"><input type="number" className="input" min={0} step="0.1" value={form.carbsG} onChange={(e) => setField('carbsG', e.target.value)} /></Field>
              <Field label="Fat (g)"><input type="number" className="input" min={0} step="0.1" value={form.fatG} onChange={(e) => setField('fatG', e.target.value)} /></Field>
              <Field label="Fiber (g)"><input type="number" className="input" min={0} step="0.1" value={form.fiberG} onChange={(e) => setField('fiberG', e.target.value)} /></Field>
              <Field label="Sugar (g)"><input type="number" className="input" min={0} step="0.1" value={form.sugarG} onChange={(e) => setField('sugarG', e.target.value)} /></Field>
              <Field label="Sodium (mg)"><input type="number" className="input" min={0} step="1" value={form.sodiumMg} onChange={(e) => setField('sodiumMg', e.target.value)} /></Field>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Saving…' : 'Save Food'}
          </button>
        </form>
      )}

      {/* Meals tab */}
      {activeTab === 'meals' && showMealForm && (
        <form onSubmit={handleSaveMeal} className="card space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">New Meal</h2>

          {mealError && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {mealError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Meal name *" required>
              <input
                className="input"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}

              />
            </Field>
            <Field label="Serving label">
              <input
                className="input"
                value={mealServing}
                onChange={(e) => setMealServing(e.target.value)}
                placeholder="1 meal"
              />
            </Field>
          </div>

          {/* Ingredient search */}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ingredients</p>
            <div className="relative">
              <input
                className="input w-full"
                placeholder="Search foods to add…"
                value={ingredientQuery}
                onChange={(e) => handleIngredientQueryChange(e.target.value)}
              />
              {ingredientSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
              )}
              {(ingredientResults.length > 0 || ingredientUsdaResults.length > 0) && (
                <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {ingredientResults.map((food) => (
                    <li key={food.id}>
                      <button
                        type="button"
                        onClick={() => addIngredient(food)}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {food.name}
                          {food.brand && <span className="text-slate-400 font-normal"> · {food.brand}</span>}
                        </p>
                        <p className="text-xs text-slate-400">{food.servingSize} · {Math.round(food.calories)} kcal</p>
                      </button>
                    </li>
                  ))}
                  {ingredientUsdaResults.map((food) => (
                    <li key={food.externalId}>
                      <button
                        type="button"
                        disabled={importingId === food.externalId}
                        onClick={() => importUsdaIngredient(food)}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {food.name}
                          {food.brand && <span className="text-slate-400 font-normal"> · {food.brand}</span>}
                          <span className="ml-1.5 text-xs text-slate-400 font-normal">USDA</span>
                        </p>
                        <p className="text-xs text-slate-400">{food.servingSize} · {Math.round(food.calories)} kcal</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Ingredients list */}
            {mealIngredients.length > 0 && (
              <ul className="space-y-2 pt-1">
                {mealIngredients.map((ing) => (
                  <li key={ing.food.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{ing.food.name}</p>
                      <p className="text-xs text-slate-400">
                        {Math.round(ing.food.calories * ing.servingCount)} kcal ·
                        P {(ing.food.proteinG * ing.servingCount).toFixed(0)}g /
                        C {(ing.food.carbsG * ing.servingCount).toFixed(0)}g /
                        F {(ing.food.fatG * ing.servingCount).toFixed(0)}g
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-slate-500">×</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={ing.servingCount}
                        onChange={(e) => updateIngredientQty(ing.food.id, Number(e.target.value))}
                        className="input w-16 text-center text-sm"
                      />
                      <span className="text-xs text-slate-400 truncate max-w-[60px]" title={ing.food.servingSize}>
                        {ing.food.servingSize}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateIngredientQty(ing.food.id, 0)}
                      className="text-slate-300 hover:text-red-500 text-lg leading-none shrink-0"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Totals preview */}
            {mealIngredients.length > 0 && (
              <div className="flex gap-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg px-3 py-2.5 text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.round(mealTotals.calories)} kcal</span>
                <span className="text-slate-500">P <span className="font-medium text-slate-700 dark:text-slate-300">{mealTotals.proteinG.toFixed(0)}g</span></span>
                <span className="text-slate-500">C <span className="font-medium text-slate-700 dark:text-slate-300">{mealTotals.carbsG.toFixed(0)}g</span></span>
                <span className="text-slate-500">F <span className="font-medium text-slate-700 dark:text-slate-300">{mealTotals.fatG.toFixed(0)}g</span></span>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary w-full" disabled={mealSaving}>
            {mealSaving ? 'Saving…' : 'Save Meal'}
          </button>
        </form>
      )}

      {/* Saved meals list */}
      {activeTab === 'meals' && (
        <div className="card">
          {loading ? (
            <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
          ) : savedMeals.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-slate-400 dark:text-slate-500">No saved meals yet.</p>
              <button
                onClick={() => { setMealError(null); setShowMealForm(true); }}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                + Create your first meal
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {savedMeals.map((f) => (
                <li key={f.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {f.servingSize} · {Math.round(f.calories)} kcal · P {f.proteinG.toFixed(0)}g / C {f.carbsG.toFixed(0)}g / F {f.fatG.toFixed(0)}g
                    </p>
                  </div>
                  <Link
                    href="/log-food?type=snack"
                    className="text-xs text-brand-600 dark:text-brand-400 px-2 py-1 hover:underline shrink-0"
                  >
                    Log
                  </Link>
                  <button
                    onClick={() => handleDeleteCustom(f.id)}
                    className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 shrink-0"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Custom foods list */}
      {activeTab === 'custom' && (
        <div className="card">
          {loading ? (
            <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
          ) : pureCustomFoods.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm text-slate-400 dark:text-slate-500">No custom foods yet.</p>
              <button
                onClick={() => { setError(null); setShowForm(true); }}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                + Create your first custom food
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {pureCustomFoods.map((f) => (
                <li key={f.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {f.name}
                      {f.brand && <span className="text-slate-400 font-normal"> · {f.brand}</span>}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {f.servingSize} · {Math.round(f.calories)} kcal · P {f.proteinG.toFixed(0)}g / C {f.carbsG.toFixed(0)}g / F {f.fatG.toFixed(0)}g
                    </p>
                  </div>
                  <Link
                    href={`/log-food?type=snack`}
                    className="text-xs text-brand-600 dark:text-brand-400 px-2 py-1 hover:underline shrink-0"
                  >
                    Log
                  </Link>
                  <button
                    onClick={() => handleDeleteCustom(f.id)}
                    className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 shrink-0"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Favorites list */}
      {activeTab === 'favorites' && (
        <div className="card">
          {loading ? (
            <p className="text-sm text-slate-400 py-4 text-center">Loading…</p>
          ) : favorites.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-2xl">★</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">No favorites yet.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Tap the ★ on any food while logging to save it here.
              </p>
              <Link
                href="/log-food"
                className="inline-block mt-2 text-xs font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 px-3 py-1.5 rounded-full hover:bg-brand-50 dark:hover:bg-brand-900/20"
              >
                Go to Log Food →
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {favorites.map((f) => (
                <li key={f.id} className="py-3 flex items-center gap-3">
                  <span className="text-amber-400 text-lg shrink-0">★</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {f.name}
                      {f.brand && <span className="text-slate-400 font-normal"> · {f.brand}</span>}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {f.servingSize} · {Math.round(f.calories)} kcal · P {f.proteinG.toFixed(0)}g
                    </p>
                  </div>
                  <Link
                    href="/log-food?type=snack"
                    className="text-xs text-brand-600 dark:text-brand-400 px-2 py-1 hover:underline shrink-0"
                  >
                    Log
                  </Link>
                  <button
                    onClick={() => handleUnfavorite(f.id)}
                    className="text-xs text-amber-400 hover:text-slate-400 px-2 py-1 shrink-0"
                    title="Remove from favorites"
                  >
                    ★
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="text-slate-400 font-normal ml-1">— {hint}</span>}
      </span>
      {children}
    </label>
  );
}
