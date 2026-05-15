'use client';

import { Suspense, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Food = {
  id: string;
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
  isCustom: boolean;
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

type Basket = { food: Food; servingCount: number };

type Tab = 'recents' | 'favorites' | 'custom' | 'search' | 'scan';
type Html5QrcodeCtor = typeof import('html5-qrcode').Html5Qrcode;

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

function LogFoodInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type') ?? '';
  const editId = searchParams.get('edit') ?? null;
  const isEditing = !!editId;
  const [mealType, setMealType] = useState(
    MEAL_TYPES.includes(typeParam) ? typeParam : defaultMealForNow(),
  );
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [basket, setBasket] = useState<Basket[]>([]);
  const [editLoading, setEditLoading] = useState(isEditing);

  const [recents, setRecents] = useState<Food[]>([]);
  const [favorites, setFavorites] = useState<Food[]>([]);
  const [custom, setCustom] = useState<Food[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [usdaResults, setUsdaResults] = useState<UsdaResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  const [photoScanning, setPhotoScanning] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const barcodeScannerRef = useRef<InstanceType<Html5QrcodeCtor> | null>(null);
  const [barcodeCameraMode, setBarcodeCameraMode] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [pendingCount, setPendingCount] = useState(1);

  const [dailyTargets, setDailyTargets] = useState<{ caloricTarget: number | null; proteinTargetG: number | null; carbTargetG: number | null; fatTargetG: number | null } | null>(null);
  const [dailyConsumed, setDailyConsumed] = useState<{ calories: number; protein: number; carbs: number; fat: number }>({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  async function lookupBarcode(code: string) {
    const clean = code.replace(/\D/g, '');
    if (!clean) return;
    setBarcodeScanning(true);
    setBarcodeError(null);
    try {
      const res = await fetch(`/api/foods/barcode/${clean}`);
      const data = await res.json();
      if (!res.ok) { setBarcodeError('Product not found. Try searching manually.'); return; }
      addToBasket(data as Food);
      setBarcodeInput('');
      setBarcodeMode(false);
    } catch {
      setBarcodeError('Something went wrong. Try again.');
    } finally {
      setBarcodeScanning(false);
    }
  }

  const barcodeFileRef = useRef<HTMLInputElement | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Load existing meal items when editing
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/meals/${editId}`)
      .then((r) => r.json())
      .then((meal) => {
        if (meal?.mealItems) {
          setBasket(
            meal.mealItems.map((item: { food: Food; servingCount: number }) => ({
              food: item.food,
              servingCount: item.servingCount,
            })),
          );
        }
        if (meal?.mealType && MEAL_TYPES.includes(meal.mealType)) {
          setMealType(meal.mealType);
        }
      })
      .finally(() => setEditLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      fetch('/api/foods/recents').then((r) => r.json()),
      fetch('/api/foods/favorites').then((r) => r.json()),
      fetch('/api/foods/mine').then((r) => r.json()),
      fetch('/api/user/profile').then((r) => r.json()),
      fetch(`/api/meals?date=${today}`).then((r) => r.json()),
    ]).then(([rec, fav, cust, profile, meals]) => {
      setRecents(Array.isArray(rec) ? rec : []);
      const favArr: Food[] = Array.isArray(fav) ? fav : [];
      setFavorites(favArr);
      setFavoriteIds(new Set(favArr.map((f) => f.id)));
      setCustom(Array.isArray(cust) ? cust : []);
      setLoaded(true);
      if (profile && !profile.error) setDailyTargets(profile);
      if (Array.isArray(meals)) {
        let cal = 0, pro = 0, carb = 0, fat = 0;
        for (const meal of meals) {
          for (const item of meal.mealItems ?? []) {
            cal += item.calories ?? 0;
            pro += item.proteinG ?? 0;
            carb += item.carbsG ?? 0;
            fat += item.fatG ?? 0;
          }
        }
        setDailyConsumed({ calories: cal, protein: pro, carbs: carb, fat: fat });
      }
    });
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setUsdaResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const [localRes, usdaRes] = await Promise.all([
        fetch(`/api/foods/search?q=${encodeURIComponent(query)}`).then((r) => r.json()),
        fetch(`/api/foods/usda-search?q=${encodeURIComponent(query)}`).then((r) => r.json()),
      ]);
      setSearchResults(Array.isArray(localRes) ? localRes : []);
      setUsdaResults(usdaRes?.results ?? []);
      setSearching(false);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (activeTab !== 'scan') setBarcodeCameraMode(false);
  }, [activeTab]);

  useEffect(() => {
    if (!barcodeCameraMode || activeTab !== 'scan') {
      const sc = barcodeScannerRef.current;
      if (sc) {
        barcodeScannerRef.current = null;
        sc.stop().catch(() => {});
      }
      return;
    }
    let cancelled = false;
    let started = false;
    (async () => {
      const mod = await import('html5-qrcode');
      if (cancelled) return;
      const sc = new mod.Html5Qrcode('log-food-barcode-reader', {
        verbose: false,
        formatsToSupport: [
          mod.Html5QrcodeSupportedFormats.EAN_13,
          mod.Html5QrcodeSupportedFormats.EAN_8,
          mod.Html5QrcodeSupportedFormats.UPC_A,
          mod.Html5QrcodeSupportedFormats.UPC_E,
          mod.Html5QrcodeSupportedFormats.CODE_128,
        ],
      });
      barcodeScannerRef.current = sc;
      try {
        await sc.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 140 } },
          async (decoded) => {
            if (cancelled) return;
            const s = barcodeScannerRef.current;
            barcodeScannerRef.current = null;
            started = false;
            if (s) { try { await s.stop(); } catch {} }
            setBarcodeCameraMode(false);
            setBarcodeScanning(true);
            setBarcodeError(null);
            try {
              const res = await fetch(`/api/foods/barcode/${encodeURIComponent(decoded.replace(/\D/g, ''))}`);
              const data = await res.json();
              if (!res.ok) {
                setBarcodeError('Product not found. Try searching manually.');
              } else {
                setBasket((prev) => {
                  const existing = prev.find((i) => i.food.id === (data as Food).id);
                  if (existing) return prev.map((i) => i.food.id === (data as Food).id ? { ...i, servingCount: i.servingCount + 1 } : i);
                  return [...prev, { food: data as Food, servingCount: 1 }];
                });
              }
            } catch { setBarcodeError('Something went wrong. Try again.'); }
            finally { setBarcodeScanning(false); }
          },
          () => {},
        );
        started = true;
        // If cancelled while start() was in-flight, stop immediately
        if (cancelled) {
          started = false;
          barcodeScannerRef.current = null;
          try { await sc.stop(); } catch {}
        }
      } catch (err) {
        barcodeScannerRef.current = null;
        if (!cancelled) {
          setBarcodeError(err instanceof Error ? err.message : 'Camera access denied.');
          setBarcodeCameraMode(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      const s = barcodeScannerRef.current;
      barcodeScannerRef.current = null;
      if (s && started) {
        started = false;
        s.stop().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeCameraMode, activeTab]);

  async function toggleFavorite(food: Food) {
    const isFav = favoriteIds.has(food.id);
    if (isFav) {
      await fetch(`/api/foods/favorites/${food.id}`, { method: 'DELETE' });
      setFavoriteIds((prev) => { const s = new Set(prev); s.delete(food.id); return s; });
      setFavorites((prev) => prev.filter((f) => f.id !== food.id));
    } else {
      await fetch('/api/foods/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foodId: food.id }),
      });
      setFavoriteIds((prev) => new Set([...prev, food.id]));
      setFavorites((prev) => (prev.find((f) => f.id === food.id) ? prev : [food, ...prev]));
    }
  }

  async function analyzePhoto(file: File, description: string) {
    setPhotoError(null);
    setPendingPhoto(null);
    setPhotoDescription('');
    setPhotoScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/meal-photo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mimeType: file.type, description: description.trim() || undefined }),
      });
      if (!res.ok) { setPhotoError('AI analysis failed. Try again.'); return; }
      const analysis = await res.json() as {
        items: Array<{ name: string; estimatedServingSize: string; quantity?: number; calories: number; proteinG: number; carbsG: number; fatG: number }>;
      };
      if (!analysis.items?.length) { setPhotoError('No food detected in photo.'); return; }

      // Import each item as a custom food, then add to basket
      for (const item of analysis.items) {
        const importRes = await fetch('/api/foods/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'ai',
            externalId: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: item.name,
            brand: 'AI Estimate',
            servingSize: item.estimatedServingSize || '1 serving',
            servingWeightG: 100,
            densityGPerMl: null,
            calories: item.calories,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
            fiberG: null,
            sugarG: null,
            sodiumMg: null,
            cholesterolMg: null,
            saturatedFatG: null,
            potassiumMg: null,
            vitaminDMcg: null,
            calciumMg: null,
            ironMg: null,
          }),
        });
        if (importRes.ok) {
          const created: Food = await importRes.json();
          addToBasket(created, item.quantity ?? 1);
        }
      }
    } catch {
      setPhotoError('Something went wrong. Try again.');
    } finally {
      setPhotoScanning(false);
      // reset so same file can be picked again
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function importUsda(food: UsdaResult) {
    setImporting(food.externalId);
    try {
      const res = await fetch('/api/foods/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(food),
      });
      if (!res.ok) return;
      const created: Food = await res.json();
      setPendingCount(1);
      setSelectedFood(created);
    } finally {
      setImporting(null);
    }
  }

  function addToBasket(food: Food, qty = 1) {
    setBasket((prev) => {
      const existing = prev.find((i) => i.food.id === food.id);
      if (existing) {
        return prev.map((i) =>
          i.food.id === food.id ? { ...i, servingCount: i.servingCount + qty } : i,
        );
      }
      return [...prev, { food, servingCount: qty }];
    });
  }

  function setServingCount(foodId: string, count: number) {
    const rounded = Math.round(count * 2) / 2;
    if (rounded <= 0) {
      setBasket((prev) => prev.filter((i) => i.food.id !== foodId));
    } else {
      setBasket((prev) =>
        prev.map((i) => (i.food.id === foodId ? { ...i, servingCount: rounded } : i)),
      );
    }
  }

  const totalCals = Math.round(basket.reduce((s, i) => s + i.food.calories * i.servingCount, 0));
  const totalProtein = Math.round(basket.reduce((s, i) => s + i.food.proteinG * i.servingCount, 0));

  function handleLog() {
    if (basket.length === 0) return;
    setLogError(null);
    startTransition(async () => {
      const url = isEditing ? `/api/meals/${editId}` : '/api/meals';
      const method = isEditing ? 'PATCH' : 'POST';
      const body = isEditing
        ? { items: basket.map((i) => ({ foodId: i.food.id, servingCount: i.servingCount })) }
        : { mealType, items: basket.map((i) => ({ foodId: i.food.id, servingCount: i.servingCount })) };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLogError(data.error ?? `Failed to save (${res.status}). Please try again.`);
        return;
      }
      router.refresh();
      router.push('/dashboard');
    });
  }

  function handleDelete() {
    if (!editId) return;
    startTransition(async () => {
      const res = await fetch(`/api/meals/${editId}`, { method: 'DELETE' });
      if (!res.ok) {
        setLogError('Failed to delete meal. Please try again.');
        return;
      }
      router.refresh();
      router.push('/dashboard');
    });
  }

  function FoodRow({ food }: { food: Food }) {
    const inBasket = basket.find((i) => i.food.id === food.id);
    const isFav = favoriteIds.has(food.id);
    function openPicker() {
      setPendingCount(inBasket?.servingCount ?? 1);
      setSelectedFood(food);
    }
    return (
      <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <button className="flex-1 min-w-0 text-left" onClick={openPicker}>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {food.name}
            {food.isCustom && (
              <span className="ml-1.5 text-[10px] font-semibold bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-full">
                Custom
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {food.brand ? `${food.brand} · ` : ''}
            {food.servingSize} · {Math.round(food.calories)} kcal ·{' '}
            <span className="text-green-600 dark:text-green-400">{food.proteinG.toFixed(0)}g protein</span>
          </p>
        </button>
        <button
          onClick={() => toggleFavorite(food)}
          className={`text-xl leading-none transition-colors shrink-0 ${
            isFav ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600 hover:text-amber-300'
          }`}
          aria-label={isFav ? 'Unfavorite' : 'Favorite'}
        >
          ★
        </button>
        <button
          onClick={openPicker}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold transition-colors shrink-0 ${
            inBasket
              ? 'bg-brand-500 text-white'
              : 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/40'
          }`}
          aria-label="Add to meal"
        >
          {inBasket ? '✓' : '+'}
        </button>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'search', label: 'Search' },
    { key: 'recents', label: 'Recents' },
    { key: 'favorites', label: 'Favorites' },
    { key: 'custom', label: 'Custom' },
    { key: 'scan', label: 'Scan' },
  ];

  const listForTab: Food[] =
    activeTab === 'recents' ? recents :
    activeTab === 'favorites' ? favorites :
    activeTab === 'custom' ? custom :
    activeTab === 'scan' ? [] :
    searchResults;

  const emptyMessages: Record<Tab, string> = {
    recents: 'No recent foods yet — log a meal first.',
    favorites: 'No favorites yet. Tap ★ on any food to save it here.',
    custom: 'No custom foods yet.',
    search: '',
    scan: '',
  };

  return (
    <div className="flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 pt-4 pb-0 space-y-3">
        {/* Back + title row */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex-1">{isEditing ? 'Edit Meal' : 'Log Food'}</h1>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingPhoto(f); setPhotoError(null); } }}
          />
          <Link href="/foods" className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline">
            + Custom
          </Link>
        </div>

        {/* Meal type chips */}
        <div className="grid grid-cols-4 gap-1.5">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize ${
                mealType === type
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand-300'
              }`}
            >
              <span>{MEAL_ICONS[type]}</span>
              {type}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex -mx-4 px-4 border-b border-slate-100 dark:border-slate-800">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 text-xs font-semibold py-2 transition-colors border-b-2 ${
                activeTab === tab.key
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
              }`}
            >
              {tab.label}
              {tab.key === 'favorites' && favorites.length > 0 && (
                <span className="ml-0.5 text-amber-400">★</span>
              )}
            </button>
          ))}
        </div>

        {/* Search input */}
        {activeTab === 'search' && (
          <div className="pb-3">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search foods..."
              className="input w-full"
            />
          </div>
        )}
      </div>

      {/* Food list */}
      <div className={`px-4 ${basket.length > 0 ? 'pb-52' : 'pb-6'}`}>
        {/* Scan tab UI */}
        {activeTab === 'scan' && (
          <div className="flex flex-col gap-3 py-6">
            {(photoError || barcodeError) && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3 py-2">
                <span className="text-red-500 text-sm flex-1">{photoError ?? barcodeError}</span>
                <button onClick={() => { setPhotoError(null); setBarcodeError(null); }} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            )}

            {/* AI Photo Scan card */}
            {!barcodeMode && (
              <div className="rounded-2xl border border-brand-200 dark:border-brand-800/50 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-800/50 p-5">
                {photoScanning ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-12 h-12 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Analysing your meal…</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Identifying foods and estimating calories</p>
                  </div>
                ) : pendingPhoto ? (
                  /* Review step — photo picked, waiting for optional description */
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setPendingPhoto(null); setPhotoDescription(''); if (photoInputRef.current) photoInputRef.current.value = ''; }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                      </button>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Photo ready ✓</p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Add a description to help the AI be more accurate — e.g. <span className="italic">"chicken tikka masala with rice"</span> or <span className="italic">"homemade pasta, generous portion"</span>.
                    </p>
                    <textarea
                      autoFocus
                      value={photoDescription}
                      onChange={(e) => setPhotoDescription(e.target.value)}
                      placeholder="Optional: describe what's in the photo…"
                      rows={2}
                      className="input w-full text-sm resize-none"
                    />
                    <button
                      onClick={() => analyzePhoto(pendingPhoto, photoDescription)}
                      className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
                    >
                      <span>✨</span> Analyse with AI
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0 text-2xl">✨</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Scan Meal with AI</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Point your camera at any meal — home-cooked, restaurant, or takeaway — and our AI instantly identifies every item and logs the calories for you.
                      </p>
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        className="btn-primary mt-3 px-4 py-2 text-xs flex items-center gap-1.5"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        Take a Photo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Barcode scan card */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-5">
              {barcodeCameraMode ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setBarcodeCameraMode(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Scanning for Barcode…</p>
                  </div>
                  <div id="log-food-barcode-reader" className="w-full rounded-xl overflow-hidden bg-black" style={{ minHeight: 200 }} />
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center">Point the camera at the barcode on the packaging.</p>
                </div>
              ) : barcodeMode ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setBarcodeMode(false); setBarcodeInput(''); setBarcodeError(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Enter Barcode</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      ref={barcodeInputRef}
                      type="number"
                      inputMode="numeric"
                      autoFocus
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') lookupBarcode(barcodeInput); }}
                      placeholder="e.g. 5000112637922"
                      className="input flex-1 text-sm"
                    />
                    <button
                      onClick={() => lookupBarcode(barcodeInput)}
                      disabled={barcodeScanning || !barcodeInput}
                      className="btn-primary px-4 py-2 text-sm shrink-0 disabled:opacity-50"
                    >
                      {barcodeScanning ? '…' : 'Look up'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Type the barcode number from the product packaging.</p>
                </div>
              ) : (
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-2xl">📦</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Scan Barcode</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Have a packaged product? Scan the barcode with your camera or enter it manually.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setBarcodeCameraMode(true)}
                        className="btn-primary px-3 py-2 text-xs flex items-center gap-1.5"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
                        </svg>
                        Camera
                      </button>
                      <button
                        onClick={() => { setBarcodeMode(true); setTimeout(() => barcodeInputRef.current?.focus(), 50); }}
                        className="px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="4" height="18" rx="1"/><rect x="9" y="3" width="2" height="18" rx="1"/><rect x="13" y="3" width="4" height="18" rx="1"/><rect x="19" y="3" width="2" height="18" rx="1"/>
                        </svg>
                        Enter Manually
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {!photoScanning && !loaded && activeTab !== 'search' && activeTab !== 'scan' ? (          <div className="py-12 text-center">
            <div className="inline-block w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'search' ? (
          <>
            {searching && (
              <div className="py-8 text-center">
                <div className="inline-block w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!searching && query.length < 2 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-10">
                Type at least 2 characters to search.
              </p>
            )}
            {!searching && query.length >= 2 && searchResults.length === 0 && usdaResults.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-10">No results found.</p>
            )}
            {searchResults.map((food) => (
              <FoodRow key={food.id} food={food} />
            ))}
            {usdaResults.length > 0 && (
              <>
                {searchResults.length > 0 && (
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mt-4 mb-1">
                    USDA Database
                  </p>
                )}
                {usdaResults.map((food) => (
                  <div
                    key={food.externalId}
                    className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{food.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {food.brand ? `${food.brand} · ` : ''}
                        {food.servingSize} · {Math.round(food.calories)} kcal
                      </p>
                    </div>
                    <button
                      disabled={importing === food.externalId}
                      onClick={() => importUsda(food)}
                      className="text-xs text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 px-2.5 py-1 rounded-full hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50 shrink-0"
                    >
                      {importing === food.externalId ? '…' : '+ Add'}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        ) : activeTab === 'scan' ? null : listForTab.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-slate-400 dark:text-slate-500">{emptyMessages[activeTab]}</p>
            {activeTab === 'custom' && (
              <Link
                href="/foods"
                className="inline-block text-xs font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 px-3 py-1.5 rounded-full hover:bg-brand-50 dark:hover:bg-brand-900/20"
              >
                Create a custom food →
              </Link>
            )}
            {activeTab === 'favorites' && (
              <button
                onClick={() => setActiveTab('search')}
                className="inline-block text-xs font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-700 px-3 py-1.5 rounded-full hover:bg-brand-50 dark:hover:bg-brand-900/20"
              >
                Search to find foods →
              </button>
            )}
          </div>
        ) : (
          listForTab.map((food) => <FoodRow key={food.id} food={food} />)
        )}
      </div>

      {/* Food serving picker sheet */}
      {selectedFood && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
          onClick={() => setSelectedFood(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl px-5 pt-5 pb-8 space-y-5 shadow-2xl max-w-[430px] mx-auto w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">{selectedFood.name}</p>
                {selectedFood.brand && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{selectedFood.brand}</p>}
              </div>
              <button onClick={() => setSelectedFood(null)} className="text-2xl leading-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 mt-0.5">×</button>
            </div>

            {/* Per-serving info */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">1 serving</span> = {selectedFood.servingSize}
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
              {Math.round(selectedFood.calories)} kcal
              <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
              {selectedFood.proteinG.toFixed(0)}g protein
            </div>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setPendingCount((c) => Math.max(0.5, Math.round((c - 0.5) * 2) / 2))}
                className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xl font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >−</button>
              <div className="text-center w-20">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{pendingCount}</span>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">servings</p>
              </div>
              <button
                onClick={() => setPendingCount((c) => Math.round((c + 0.5) * 2) / 2)}
                className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xl font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >+</button>
            </div>

            {/* Totals preview */}
            <div className="flex justify-center gap-6 text-center">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{Math.round(selectedFood.calories * pendingCount)}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">kcal</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{(selectedFood.proteinG * pendingCount).toFixed(0)}g</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">protein</p>
              </div>
              <div>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{(selectedFood.carbsG * pendingCount).toFixed(0)}g</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">carbs</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{(selectedFood.fatG * pendingCount).toFixed(0)}g</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">fat</p>
              </div>
            </div>

            {/* Daily progress */}
            {dailyTargets && (() => {
              const addCal = Math.round(selectedFood.calories * pendingCount);
              const addPro = Math.round(selectedFood.proteinG * pendingCount);
              const addCarb = Math.round(selectedFood.carbsG * pendingCount);
              const addFat = Math.round(selectedFood.fatG * pendingCount);
              const tCal = dailyTargets.caloricTarget ?? 2000;
              const tPro = dailyTargets.proteinTargetG ?? 150;
              const tCarb = dailyTargets.carbTargetG ?? 200;
              const tFat = dailyTargets.fatTargetG ?? 65;
              const rows = [
                { label: 'Calories', consumed: dailyConsumed.calories, add: addCal, target: tCal, color: 'bg-slate-500' },
                { label: 'Protein', consumed: dailyConsumed.protein, add: addPro, target: tPro, color: 'bg-green-500' },
                { label: 'Carbs', consumed: dailyConsumed.carbs, add: addCarb, target: tCarb, color: 'bg-blue-500' },
                { label: 'Fat', consumed: dailyConsumed.fat, add: addFat, target: tFat, color: 'bg-amber-500' },
              ];
              return (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Daily progress after adding</p>
                  {rows.map(({ label, consumed, add, target, color }) => {
                    const afterPct = Math.min(100, Math.round(((consumed + add) / target) * 100));
                    const consumedPct = Math.min(100, Math.round((consumed / target) * 100));
                    const remaining = Math.max(0, target - consumed - add);
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                          <span>{label}</span>
                          <span>{Math.round(consumed + add)} / {target}{label === 'Calories' ? ' kcal' : 'g'} <span className="text-slate-400">({remaining}{label === 'Calories' ? ' kcal' : 'g'} left)</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                          <div className={`absolute inset-y-0 left-0 rounded-full opacity-40 ${color}`} style={{ width: `${consumedPct}%` }} />
                          <div className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${afterPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Add button */}
            <button
              onClick={() => {
                const existing = basket.find((i) => i.food.id === selectedFood.id);
                if (existing) {
                  setBasket((prev) => prev.map((i) => i.food.id === selectedFood.id ? { ...i, servingCount: pendingCount } : i));
                } else {
                  addToBasket(selectedFood, pendingCount);
                }
                setSelectedFood(null);
              }}
              className="btn-primary w-full py-3 text-base font-semibold"
            >
              {basket.find((i) => i.food.id === selectedFood.id) ? 'Update serving' : 'Add to meal'}
            </button>
          </div>
        </div>
      )}

      {/* Basket — sits above nav bar */}
      {editLoading ? (
        <div className="fixed left-0 right-0 z-40 max-w-[430px] mx-auto bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 py-4 flex items-center justify-center shadow-lg" style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : basket.length > 0 && (
        <div
          className="fixed left-0 right-0 z-40 max-w-[430px] mx-auto bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 pt-3 pb-4 space-y-3 shadow-lg"
          style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {basket.map((item) => (
              <div key={item.food.id} className="flex items-center gap-2">
                <p className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{item.food.name}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setServingCount(item.food.id, item.servingCount - 0.5)}
                    className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
                  >
                    −
                  </button>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-8 text-center">
                    {item.servingCount}×
                  </span>
                  <button
                    onClick={() => setServingCount(item.food.id, item.servingCount + 0.5)}
                    className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 w-14 text-right shrink-0">
                  {Math.round(item.food.calories * item.servingCount)} kcal
                </span>
              </div>
            ))}
          </div>
          {logError && (
            <p className="text-xs text-red-500 dark:text-red-400 mb-2">{logError}</p>
          )}
          <div className="flex items-center gap-3">
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
                title="Delete meal"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                </svg>
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {totalCals} kcal · {totalProtein}g protein · {basket.length} item{basket.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={handleLog}
              disabled={isPending}
              className="btn-primary px-5 py-2.5 text-sm shrink-0 capitalize"
            >
              {isPending ? (isEditing ? 'Saving…' : 'Logging…') : (isEditing ? 'Save Changes' : `Log ${mealType}`)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LogFoodPage() {
  return (
    <Suspense fallback={null}>
      <LogFoodInner />
    </Suspense>
  );
}

