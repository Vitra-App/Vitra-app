"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MealPhotoAnalysis } from "@/lib/ai-service";

type EditableItem = MealPhotoAnalysis["items"][number] & { id: string };

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

function defaultMealForNow(): string {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

export default function MealPhotoPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MealPhotoAnalysis | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [mealType, setMealType] = useState(defaultMealForNow());
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setMimeType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
    setAnalysis(null); setItems([]); setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function handleAnalyze() {
    if (!base64) return;
    setAnalyzing(true); setError(null);
    try {
      const res = await fetch("/api/meal-photo/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType }),
      });
      if (!res.ok) throw new Error("failed");
      const data: MealPhotoAnalysis = await res.json();
      setAnalysis(data);
      setItems(data.items.map((item, i) => ({ ...item, id: String(i) })));
    } catch {
      setError("Could not analyse the photo. Please try again or log food manually.");
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(id: string, field: keyof EditableItem, value: string | number) {
    setItems((prev) => prev.map((item) =>
      item.id === id ? { ...item, [field]: typeof value === "string" ? value : Number(value) } : item
    ));
  }
  function removeItem(id: string) { setItems((prev) => prev.filter((i) => i.id !== id)); }
  function addItem() {
    setItems((prev) => [...prev, { id: Date.now().toString(), name: "", estimatedServingSize: "1 serving", calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }]);
  }
  function reset() { setPreview(null); setBase64(null); setAnalysis(null); setItems([]); setError(null); }

  const totals = items.reduce(
    (acc, i) => ({ cal: acc.cal + i.calories, p: acc.p + i.proteinG, c: acc.c + i.carbsG, f: acc.f + i.fatG }),
    { cal: 0, p: 0, c: 0, f: 0 },
  );

  async function handleSave() {
    if (items.length === 0) return;
    startTransition(async () => {
      await fetch("/api/meal-photo/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealType, items }),
      });
      router.push("/dashboard");
      router.refresh();
    });
  }

  const pct = Math.round((analysis?.confidenceScore ?? 0) * 100);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Photo Log</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Take a photo of your meal and let AI estimate the nutrition.</p>
      </div>

      {!preview && (
        <div className="space-y-3">
          <button
            className="w-full rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 py-14 flex flex-col items-center gap-4 active:scale-[0.98] transition"
            onClick={() => cameraRef.current?.click()}
          >
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600 dark:text-brand-400">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Take a Photo</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Opens your camera</p>
            </div>
          </button>
          <button className="btn-secondary w-full" onClick={() => galleryRef.current?.click()}>Choose from Library</button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {preview && (
        <div className="relative rounded-2xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="meal preview" className="w-full max-h-72 object-cover rounded-2xl" />
          <button onClick={reset} className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white text-base leading-none">
            x
          </button>
        </div>
      )}

      {preview && !analysis && (
        <button className="btn-primary w-full" onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analysing...
            </span>
          ) : "Analyse with AI"}
        </button>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {analysis && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: pct + "%" }} />
            </div>
            <span className="shrink-0">{pct}% confidence</span>
          </div>

          <div className="card">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2.5">Meal Type</p>
            <div className="flex gap-2 flex-wrap">
              {MEAL_TYPES.map((t) => (
                <button key={t} onClick={() => setMealType(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition capitalize ${mealType === t ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-brand-300"}`}
                >{t}</button>
              ))}
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Detected Foods</h2>
              <button onClick={addItem} className="text-xs text-brand-600 dark:text-brand-400 font-medium">+ Add item</button>
            </div>
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-100 dark:border-slate-700 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input className="input flex-1 text-sm" value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} placeholder="Food name" />
                  <button onClick={() => removeItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 text-xl leading-none shrink-0">x</button>
                </div>
                <input className="input text-sm" value={item.estimatedServingSize} onChange={(e) => updateItem(item.id, "estimatedServingSize", e.target.value)} placeholder="Serving size" />
                <div className="grid grid-cols-2 gap-2">
                  {([["Calories (kcal)", "calories"], ["Protein (g)", "proteinG"], ["Carbs (g)", "carbsG"], ["Fat (g)", "fatG"]] as [string, keyof EditableItem][]).map(([label, field]) => (
                    <div key={field}>
                      <label className="label text-xs">{label}</label>
                      <input type="number" min={0} className="input" value={(item as Record<string, unknown>)[field] as number} onChange={(e) => updateItem(item.id, field, parseFloat(e.target.value) || 0)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 grid grid-cols-4 gap-1.5 text-center text-xs">
              {([{ label: "Cal", val: Math.round(totals.cal), unit: "kcal" }, { label: "Protein", val: totals.p.toFixed(0), unit: "g" }, { label: "Carbs", val: totals.c.toFixed(0), unit: "g" }, { label: "Fat", val: totals.f.toFixed(0), unit: "g" }]).map((m) => (
                <div key={m.label} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg py-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{m.val}<span className="font-normal text-[10px] text-slate-400 ml-0.5">{m.unit}</span></p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
            <button className="btn-primary w-full" onClick={handleSave} disabled={isPending || items.length === 0}>
              {isPending ? "Saving..." : "Log as " + mealType}
            </button>
          </div>

          <button className="btn-secondary w-full text-sm" onClick={reset}>Try another photo</button>
        </div>
      )}
    </div>
  );
}
