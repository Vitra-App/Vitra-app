'use client';

import { useEffect, useState } from 'react';
import { getDefaultUnitSystem, kgToLb, lbToKg } from '@/lib/measurements';

export type Goal = 'lose_weight' | 'maintain' | 'gain_weight';

const GOALS: { value: Goal; label: string; icon: string }[] = [
  { value: 'lose_weight', label: 'Lose Weight', icon: '🎯' },
  { value: 'maintain', label: 'Maintain', icon: '⚖️' },
  { value: 'gain_weight', label: 'Gain Weight', icon: '📈' },
];

// Weekly rates expressed in lb (the source of truth for the picker).
// Stored canonically as kg in the parent's `weeklyWeightChangeKg`.
const RATES_LB = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];

interface Props {
  goal: Goal | '';
  // Always positive magnitude in kg; sign is derived from the goal.
  // Empty string when unset.
  weeklyWeightChangeKg: string;
  onChange: (next: { goal: Goal | ''; weeklyWeightChangeKg: string }) => void;
}

export function GoalPicker({ goal, weeklyWeightChangeKg, onChange }: Props) {
  const [unit, setUnit] = useState<'imperial' | 'metric'>('imperial');

  useEffect(() => {
    setUnit(getDefaultUnitSystem());
  }, []);

  const magnitudeKg = weeklyWeightChangeKg ? Math.abs(parseFloat(weeklyWeightChangeKg)) : 0;

  function pickGoal(g: Goal) {
    if (g === 'maintain') {
      onChange({ goal: g, weeklyWeightChangeKg: '0' });
    } else {
      // Default to 0.5 lb/week if no rate yet.
      const next = magnitudeKg > 0 ? magnitudeKg : lbToKg(0.5);
      const signed = g === 'lose_weight' ? -next : next;
      onChange({ goal: g, weeklyWeightChangeKg: signed.toFixed(4) });
    }
  }

  function pickRate(magKg: number) {
    if (!goal || goal === 'maintain') return;
    const signed = goal === 'lose_weight' ? -magKg : magKg;
    onChange({ goal, weeklyWeightChangeKg: signed.toFixed(4) });
  }

  return (
    <div className="space-y-4">
      {/* Goal buttons */}
      <div className="grid grid-cols-3 gap-2">
        {GOALS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => pickGoal(g.value)}
            className={`p-3 rounded-xl border text-center transition ${
              goal === g.value
                ? 'bg-brand-50 border-brand-400 text-brand-700'
                : 'bg-white border-slate-200 text-slate-700 hover:border-brand-200'
            }`}
          >
            <div className="text-xl mb-0.5">{g.icon}</div>
            <div className="text-xs font-medium">{g.label}</div>
          </button>
        ))}
      </div>

      {/* Rate picker — only when not maintaining */}
      {goal && goal !== 'maintain' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">
              {goal === 'lose_weight' ? 'Lose' : 'Gain'} per week
            </label>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[10px] font-medium">
              <button
                type="button"
                onClick={() => setUnit('imperial')}
                className={`px-2 py-0.5 rounded-md transition ${
                  unit === 'imperial' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                lb
              </button>
              <button
                type="button"
                onClick={() => setUnit('metric')}
                className={`px-2 py-0.5 rounded-md transition ${
                  unit === 'metric' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                kg
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {RATES_LB.map((lb) => {
              const kg = lbToKg(lb);
              const isActive = Math.abs(kg - magnitudeKg) < 0.005;
              const label = unit === 'imperial' ? `${lb} lb` : `${kg.toFixed(2)} kg`;
              return (
                <button
                  key={lb}
                  type="button"
                  onClick={() => pickRate(kg)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 mt-2">
            {magnitudeKg > 0 && (
              <>
                ≈ {kgToLb(magnitudeKg).toFixed(2)} lb / {magnitudeKg.toFixed(2)} kg per week
                {magnitudeKg > lbToKg(1.5) && (
                  <span className="text-amber-600"> · aggressive — consider a slower rate</span>
                )}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
