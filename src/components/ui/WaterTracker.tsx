'use client';

import { useEffect, useState } from 'react';

const GLASS_ML = 250;
const DAILY_GOAL_ML = 2000;

export function WaterTracker() {
  const [waterMl, setWaterMl] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/water')
      .then((r) => r.json())
      .then((d) => setWaterMl(d.waterMl ?? 0));
  }, []);

  async function add(ml: number) {
    const next = Math.max(0, waterMl + ml);
    setWaterMl(next);
    setSaving(true);
    await fetch('/api/water', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waterMl: next }),
    });
    setSaving(false);
  }

  const glasses = Math.round(waterMl / GLASS_ML);
  const pct = Math.min(100, (waterMl / DAILY_GOAL_ML) * 100);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Water</h2>
        <span className="text-xs text-slate-400 dark:text-slate-500">{saving ? 'Saving…' : `${(waterMl / 1000).toFixed(1)} L / 2.0 L`}</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Glass icons */}
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={`text-lg transition-opacity ${i < glasses ? 'opacity-100' : 'opacity-20'}`}>
            💧
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => add(GLASS_ML)}
          className="flex-1 btn-secondary text-sm text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800 hover:bg-sky-50 dark:hover:bg-sky-900/20"
        >
          + Glass (250 ml)
        </button>
        {waterMl > 0 && (
          <button
            onClick={() => add(-GLASS_ML)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm transition-colors"
            aria-label="Remove glass"
          >
            −
          </button>
        )}
      </div>
    </div>
  );
}
