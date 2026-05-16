'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Entry {
  id: string;
  weightKg: number;
  loggedAt: string;
}

export function WeightWidget() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/weight?limit=7')
      .then((r) => r.json())
      .then((d) => {
        setEntries(Array.isArray(d) ? d : []);
        setLoaded(true);
      });
  }, []);

  async function logWeight() {
    const kg = parseFloat(input);
    if (!Number.isFinite(kg) || kg <= 0) return;
    setSaving(true);
    const res = await fetch('/api/weight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightKg: kg }),
    });
    if (res.ok) {
      const entry: Entry = await res.json();
      setEntries((prev) => [entry, ...prev].slice(0, 7));
      setInput('');
    }
    setSaving(false);
  }

  if (!loaded) return null;

  const latest = entries[0];
  const prev = entries[1];
  const diff = latest && prev ? latest.weightKg - prev.weightKg : null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Weight</h2>
        <Link href="/progress" className="text-xs text-brand-600 dark:text-brand-400">
          View history ↗
        </Link>
      </div>

      {latest && (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{latest.weightKg.toFixed(1)}</span>
          <span className="text-sm text-slate-400">kg</span>
          {diff !== null && (
            <span className={`text-sm font-medium ${diff < 0 ? 'text-green-500' : diff > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
              {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          min="30"
          max="500"
          placeholder="Enter weight (kg)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && logWeight()}
          className="input flex-1 text-sm"
        />
        <button
          onClick={logWeight}
          disabled={saving || !input}
          className="btn-primary px-4 text-sm"
        >
          {saving ? '…' : 'Log'}
        </button>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">No entries yet. Log your weight to track progress.</p>
      )}
    </div>
  );
}
