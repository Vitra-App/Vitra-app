'use client';

import { useMemo, useState, useTransition } from 'react';
import { AIInsightCard } from '@/components/ui/AIInsightCard';
import type { BloodworkMarker } from '@prisma/client';

// Habit suggestions keyed by marker name, for out-of-range values
const HABIT_SUGGESTIONS: Record<string, { icon: string; name: string; category: string }[]> = {
  'Vitamin D (25-OH)': [
    { icon: '☀️', name: 'Get 15 min of sunlight daily', category: 'lifestyle' },
    { icon: '💊', name: 'Take vitamin D supplement', category: 'nutrition' },
  ],
  'Vitamin B12': [
    { icon: '💊', name: 'Take B12 supplement daily', category: 'nutrition' },
  ],
  'Ferritin': [
    { icon: '🥩', name: 'Eat iron-rich foods daily', category: 'nutrition' },
    { icon: '🍊', name: 'Pair iron foods with vitamin C', category: 'nutrition' },
  ],
  'LDL Cholesterol': [
    { icon: '🥗', name: 'Reduce saturated fat intake', category: 'nutrition' },
    { icon: '🚶', name: 'Walk 30 min after meals', category: 'lifestyle' },
  ],
  'HDL Cholesterol': [
    { icon: '🏃', name: 'Do cardio 3× per week', category: 'lifestyle' },
    { icon: '🐟', name: 'Add omega-3 rich foods', category: 'nutrition' },
  ],
  'Fasting Glucose': [
    { icon: '🍬', name: 'Reduce refined sugar intake', category: 'nutrition' },
    { icon: '🚶', name: 'Walk 10 min after eating', category: 'lifestyle' },
  ],
  'HbA1c': [
    { icon: '🍬', name: 'Reduce refined sugar intake', category: 'nutrition' },
    { icon: '🏃', name: 'Exercise 30 min daily', category: 'lifestyle' },
  ],
  'Triglycerides': [
    { icon: '🍞', name: 'Limit refined carbs and sugar', category: 'nutrition' },
    { icon: '🐟', name: 'Add omega-3 rich foods', category: 'nutrition' },
  ],
  'TSH': [
    { icon: '🧘', name: 'Practice stress management daily', category: 'lifestyle' },
    { icon: '😴', name: 'Prioritize 7-8 hours of sleep', category: 'lifestyle' },
  ],
};

// Master list of markers shown on every log panel. Users can leave any blank.
const COMMON_MARKERS = [
  { name: 'LDL Cholesterol', unit: 'mg/dL', refMin: 0, refMax: 100 },
  { name: 'HDL Cholesterol', unit: 'mg/dL', refMin: 40, refMax: 60 },
  { name: 'Total Cholesterol', unit: 'mg/dL', refMin: 0, refMax: 200 },
  { name: 'Triglycerides', unit: 'mg/dL', refMin: 0, refMax: 150 },
  { name: 'Fasting Glucose', unit: 'mg/dL', refMin: 70, refMax: 100 },
  { name: 'HbA1c', unit: '%', refMin: 0, refMax: 5.7 },
  { name: 'Vitamin D (25-OH)', unit: 'ng/mL', refMin: 30, refMax: 100 },
  { name: 'Vitamin B12', unit: 'pg/mL', refMin: 200, refMax: 900 },
  { name: 'Ferritin', unit: 'ng/mL', refMin: 12, refMax: 300 },
  { name: 'TSH', unit: 'mIU/L', refMin: 0.4, refMax: 4.0 },
  { name: 'ALT', unit: 'U/L', refMin: 0, refMax: 40 },
  { name: 'AST', unit: 'U/L', refMin: 0, refMax: 40 },
  { name: 'Creatinine', unit: 'mg/dL', refMin: 0.6, refMax: 1.2 },
  { name: 'Testosterone (Total)', unit: 'ng/dL', refMin: 300, refMax: 1000 },
];

interface Props {
  initialMarkers: BloodworkMarker[];
  profile: { sex: string | null; goal: string | null } | null;
  latestInsight: { content: string; generatedAt: string } | null;
}

type LogGroup = { date: string; markers: BloodworkMarker[] };

function groupByDate(markers: BloodworkMarker[]): LogGroup[] {
  const map = new Map<string, BloodworkMarker[]>();
  for (const m of markers) {
    const key = new Date(m.testedAt).toISOString().slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .map(([date, arr]) => ({ date, markers: arr }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
}

function statusFlag(value: number, refMin: number | null, refMax: number | null) {
  if (refMin == null || refMax == null) return null;
  if (value < refMin) return { label: 'Low', cls: 'bg-blue-100 text-blue-700' };
  if (value > refMax) return { label: 'High', cls: 'bg-red-100 text-red-700' };
  return { label: 'Normal', cls: 'bg-green-100 text-green-700' };
}

export function BloodworkClient({ initialMarkers, latestInsight }: Props) {
  const [markers, setMarkers] = useState<BloodworkMarker[]>(initialMarkers);
  const [insight, setInsight] = useState(latestInsight);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [createdHabits, setCreatedHabits] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByDate(markers), [markers]);

  // --- New-log panel state ----------------------------------------------------
  const [showNewLog, setShowNewLog] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logNotes, setLogNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [extraMarkers, setExtraMarkers] = useState<
    { name: string; unit: string; refMin: string; refMax: string; value: string }[]
  >([]);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  function resetNewLog() {
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogNotes('');
    setValues({});
    setExtraMarkers([]);
    setSaveError(null);
  }

  function handleSaveLog(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    const payloadMarkers: Array<{
      markerName: string;
      value: number;
      unit: string;
      referenceMin: number | null;
      referenceMax: number | null;
      notes?: string;
    }> = [];

    for (const m of COMMON_MARKERS) {
      const raw = values[m.name];
      if (raw == null || raw.trim() === '') continue;
      const n = parseFloat(raw);
      if (!Number.isFinite(n)) continue;
      payloadMarkers.push({
        markerName: m.name,
        value: n,
        unit: m.unit,
        referenceMin: m.refMin,
        referenceMax: m.refMax,
        notes: logNotes || undefined,
      });
    }

    for (const x of extraMarkers) {
      if (!x.name.trim() || !x.value.trim() || !x.unit.trim()) continue;
      const n = parseFloat(x.value);
      if (!Number.isFinite(n)) continue;
      payloadMarkers.push({
        markerName: x.name.trim(),
        value: n,
        unit: x.unit.trim(),
        referenceMin: x.refMin ? parseFloat(x.refMin) : null,
        referenceMax: x.refMax ? parseFloat(x.refMax) : null,
        notes: logNotes || undefined,
      });
    }

    if (payloadMarkers.length === 0) {
      setSaveError('Enter a value for at least one marker.');
      return;
    }

    startTransition(async () => {
      const res = await fetch('/api/bloodwork/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testedAt: logDate, markers: payloadMarkers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSaveError(body.error || 'Failed to save log.');
        return;
      }
      const data: { markers: BloodworkMarker[] } = await res.json();
      setMarkers((prev) => [...data.markers, ...prev]);
      resetNewLog();
      setShowNewLog(false);
    });
  }

  async function handleDeleteLog(date: string) {
    if (!confirm(`Delete the entire log for ${date}? This removes every marker on that date.`)) return;
    const res = await fetch(`/api/bloodwork/log/${date}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Failed to delete log.');
      return;
    }
    const day = date;
    setMarkers((prev) =>
      prev.filter((m) => new Date(m.testedAt).toISOString().slice(0, 10) !== day),
    );
  }

  async function handleDeleteMarker(id: string) {
    await fetch(`/api/bloodwork/${id}`, { method: 'DELETE' });
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleGenerateInsight() {
    setLoadingInsight(true);
    try {
      const res = await fetch('/api/bloodwork/insight', { method: 'POST' });
      const data: { content: string; generatedAt: string } = await res.json();
      setInsight(data);
    } finally {
      setLoadingInsight(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bloodwork</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Each log is a dated panel of all your markers. Add a new log every time you get new lab results.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            if (showNewLog) resetNewLog();
            setShowNewLog((v) => !v);
          }}
        >
          {showNewLog ? 'Cancel' : '+ New Log'}
        </button>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ <strong>Educational use only.</strong> This feature is not a medical diagnostic tool. All insights are general and educational. Always review your lab results with a licensed healthcare professional.
      </div>

      {/* New-log panel */}
      {showNewLog && (
        <form onSubmit={handleSaveLog} className="card space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">New Bloodwork Log</h2>
              <p className="text-xs text-slate-500 mt-0.5">Fill in only the markers you have values for. Leave the rest blank.</p>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="label">Test Date</label>
                <input
                  required
                  type="date"
                  className="input"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {saveError && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="pb-2 px-2 text-left font-medium">Marker</th>
                  <th className="pb-2 px-2 text-left font-medium w-32">Value</th>
                  <th className="pb-2 px-2 text-left font-medium w-24">Unit</th>
                  <th className="pb-2 px-2 text-left font-medium w-32 hidden sm:table-cell">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {COMMON_MARKERS.map((m) => (
                  <tr key={m.name}>
                    <td className="py-1.5 px-2 font-medium text-slate-700">{m.name}</td>
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        step="any"
                        className="input py-1.5"
                        value={values[m.name] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [m.name]: e.target.value }))}
                        placeholder="—"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-xs text-slate-500">{m.unit}</td>
                    <td className="py-1.5 px-2 text-xs text-slate-400 hidden sm:table-cell">
                      {m.refMin}–{m.refMax}
                    </td>
                  </tr>
                ))}

                {extraMarkers.map((x, i) => (
                  <tr key={`extra-${i}`} className="bg-slate-50/40">
                    <td className="py-1.5 px-2">
                      <input
                        className="input py-1.5"
                        placeholder="Custom marker name"
                        value={x.name}
                        onChange={(e) =>
                          setExtraMarkers((arr) => arr.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))
                        }
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        type="number"
                        step="any"
                        className="input py-1.5"
                        value={x.value}
                        onChange={(e) =>
                          setExtraMarkers((arr) => arr.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))
                        }
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <input
                        className="input py-1.5"
                        placeholder="unit"
                        value={x.unit}
                        onChange={(e) =>
                          setExtraMarkers((arr) => arr.map((y, j) => (j === i ? { ...y, unit: e.target.value } : y)))
                        }
                      />
                    </td>
                    <td className="py-1.5 px-2 hidden sm:table-cell">
                      <div className="flex gap-1">
                        <input
                          type="number"
                          step="any"
                          className="input py-1.5 w-16"
                          placeholder="min"
                          value={x.refMin}
                          onChange={(e) =>
                            setExtraMarkers((arr) => arr.map((y, j) => (j === i ? { ...y, refMin: e.target.value } : y)))
                          }
                        />
                        <input
                          type="number"
                          step="any"
                          className="input py-1.5 w-16"
                          placeholder="max"
                          value={x.refMax}
                          onChange={(e) =>
                            setExtraMarkers((arr) => arr.map((y, j) => (j === i ? { ...y, refMax: e.target.value } : y)))
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center flex-wrap gap-3">
            <button
              type="button"
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              onClick={() =>
                setExtraMarkers((arr) => [...arr, { name: '', unit: '', refMin: '', refMax: '', value: '' }])
              }
            >
              + Add custom marker
            </button>

            <div className="flex-1 min-w-[200px]">
              <input
                className="input"
                placeholder="Notes for this log (optional)"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Log'}
          </button>
        </form>
      )}

      {/* AI insight */}
      {insight ? (
        <AIInsightCard content={insight.content} generatedAt={insight.generatedAt} />
      ) : (
        <div className="card text-center py-6">
          <p className="text-sm text-slate-500 mb-4">
            {markers.length === 0
              ? 'Add a bloodwork log to generate an AI summary.'
              : 'Generate an AI educational summary of your bloodwork.'}
          </p>
          <button
            className="btn-primary"
            disabled={markers.length === 0 || loadingInsight}
            onClick={handleGenerateInsight}
          >
            {loadingInsight ? '🤖 Generating…' : '✨ Generate Summary'}
          </button>
        </div>
      )}

      {/* Habit suggestions — based on out-of-range markers */}
      {(() => {
        const outOfRange = markers.filter((m) => {
          const ref = COMMON_MARKERS.find((c) => c.name === m.markerName);
          if (!ref) return false;
          return m.value < ref.refMin || m.value > ref.refMax;
        });
        const uniqueMarkerNames = [...new Set(outOfRange.map((m) => m.markerName))];
        const suggestions = uniqueMarkerNames.flatMap((name) => HABIT_SUGGESTIONS[name] ?? []);
        if (suggestions.length === 0) return null;

        return (
          <div className="card space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Suggested habits for your results
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Based on your out-of-range markers. Tap + to add to your daily habits.
              </p>
            </div>
            <ul className="space-y-2">
              {suggestions.map((s) => {
                const added = createdHabits.has(s.name);
                return (
                  <li key={s.name} className="flex items-center gap-3">
                    <span className="text-lg shrink-0">{s.icon}</span>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{s.name}</span>
                    <button
                      disabled={added}
                      onClick={async () => {
                        const res = await fetch('/api/habits', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: s.name,
                            icon: s.icon,
                            category: s.category,
                            sourceType: 'bloodwork',
                          }),
                        });
                        if (res.ok) {
                          setCreatedHabits((prev) => new Set([...prev, s.name]));
                        }
                      }}
                      className={`text-xs shrink-0 px-2.5 py-1 rounded-full border font-medium transition-colors ${
                        added
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30 text-green-600 dark:text-green-400'
                          : 'border-brand-200 dark:border-brand-700 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                      }`}
                    >
                      {added ? '✓ Added' : '+ Add'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {/* Logs */}
      {groups.length === 0 ? (
        <div className="card text-center py-10 text-sm text-slate-400">
          No bloodwork logs yet. Click <span className="font-medium text-slate-600">+ New Log</span> to add one.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <LogCard
              key={g.date}
              group={g}
              onDeleteLog={() => handleDeleteLog(g.date)}
              onDeleteMarker={handleDeleteMarker}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LogCard({
  group,
  onDeleteLog,
  onDeleteMarker,
}: {
  group: LogGroup;
  onDeleteLog: () => void;
  onDeleteMarker: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const dateLabel = new Date(`${group.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left"
        >
          <span className="text-slate-400 text-xs">{open ? '▼' : '▶'}</span>
          <h3 className="text-sm font-semibold text-slate-800">{dateLabel}</h3>
          <span className="text-xs text-slate-400">({group.markers.length} markers)</span>
        </button>
        <button
          onClick={onDeleteLog}
          className="text-xs text-slate-400 hover:text-red-600 px-2 py-1"
        >
          Delete log
        </button>
      </div>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 text-left font-medium">Marker</th>
                <th className="pb-2 text-right font-medium">Value</th>
                <th className="pb-2 text-right font-medium">Reference</th>
                <th className="pb-2 text-right font-medium">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {group.markers.map((m) => {
                const flag = statusFlag(m.value, m.referenceMin, m.referenceMax);
                return (
                  <tr key={m.id}>
                    <td className="py-2 font-medium text-slate-800">{m.markerName}</td>
                    <td className="py-2 text-right text-slate-700">{m.value} {m.unit}</td>
                    <td className="py-2 text-right text-slate-400 text-xs">
                      {m.referenceMin != null && m.referenceMax != null ? `${m.referenceMin}–${m.referenceMax}` : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {flag && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${flag.cls}`}>{flag.label}</span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => onDeleteMarker(m.id)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
