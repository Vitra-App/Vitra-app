'use client';

import { useEffect, useState } from 'react';
import {
  cmToFtIn,
  ftInToCm,
  getDefaultUnitSystem,
  kgToLb,
  lbToKg,
  saveUnitSystem,
  type UnitSystem,
} from '@/lib/measurements';

interface Props {
  // Canonical values — always cm/kg. Empty string when unset.
  heightCm: string;
  weightKg: string;
  onChange: (next: { heightCm: string; weightKg: string }) => void;
}

// Reusable height + weight inputs that flip between imperial (ft/in + lb)
// and metric (cm + kg). Always emits cm/kg back to the parent so the API
// payload stays unchanged.
export function HeightWeightInputs({ heightCm, weightKg, onChange }: Props) {
  const [unit, setUnit] = useState<UnitSystem>('imperial');

  // Load saved preference on mount.
  useEffect(() => {
    setUnit(getDefaultUnitSystem());
  }, []);

  // Local imperial fields (kept in sync with cm/kg props).
  const [ft, setFt] = useState('');
  const [inches, setInches] = useState('');
  const [lb, setLb] = useState('');

  // Whenever the canonical cm/kg or the unit system changes, refill the
  // imperial fields from the source of truth.
  useEffect(() => {
    if (heightCm) {
      const { ft: f, inches: i } = cmToFtIn(parseFloat(heightCm));
      setFt(String(f));
      setInches(i ? i.toFixed(1).replace(/\.0$/, '') : '0');
    } else {
      setFt('');
      setInches('');
    }
  }, [heightCm, unit]);

  useEffect(() => {
    if (weightKg) {
      setLb(kgToLb(parseFloat(weightKg)).toFixed(1).replace(/\.0$/, ''));
    } else {
      setLb('');
    }
  }, [weightKg, unit]);

  function setUnitAndPersist(u: UnitSystem) {
    setUnit(u);
    saveUnitSystem(u);
  }

  function handleFt(v: string) {
    setFt(v);
    const f = parseFloat(v);
    const i = parseFloat(inches || '0');
    if (!Number.isFinite(f) && !Number.isFinite(i)) {
      onChange({ heightCm: '', weightKg });
      return;
    }
    const cm = ftInToCm(Number.isFinite(f) ? f : 0, Number.isFinite(i) ? i : 0);
    onChange({ heightCm: cm.toFixed(2), weightKg });
  }

  function handleIn(v: string) {
    setInches(v);
    const f = parseFloat(ft || '0');
    const i = parseFloat(v);
    if (!Number.isFinite(f) && !Number.isFinite(i)) {
      onChange({ heightCm: '', weightKg });
      return;
    }
    const cm = ftInToCm(Number.isFinite(f) ? f : 0, Number.isFinite(i) ? i : 0);
    onChange({ heightCm: cm.toFixed(2), weightKg });
  }

  function handleLb(v: string) {
    setLb(v);
    const n = parseFloat(v);
    if (!Number.isFinite(n)) {
      onChange({ heightCm, weightKg: '' });
      return;
    }
    onChange({ heightCm, weightKg: lbToKg(n).toFixed(2) });
  }

  function handleCm(v: string) {
    onChange({ heightCm: v, weightKg });
  }

  function handleKg(v: string) {
    onChange({ heightCm, weightKg: v });
  }

  return (
    <div className="space-y-3">
      {/* Unit toggle */}
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setUnitAndPersist('imperial')}
            className={`px-2.5 py-1 rounded-md transition ${
              unit === 'imperial' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            ft / lb
          </button>
          <button
            type="button"
            onClick={() => setUnitAndPersist('metric')}
            className={`px-2.5 py-1 rounded-md transition ${
              unit === 'metric' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
            }`}
          >
            cm / kg
          </button>
        </div>
      </div>

      {unit === 'imperial' ? (
        <>
          <div>
            <label className="label">Height</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  min={0}
                  className="input pr-8"
                  placeholder="5"
                  value={ft}
                  onChange={(e) => handleFt(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">ft</span>
              </div>
              <div className="flex-1 relative">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="input pr-8"
                  placeholder="10"
                  value={inches}
                  onChange={(e) => handleIn(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">in</span>
              </div>
            </div>
          </div>
          <div>
            <label className="label">Weight</label>
            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.1"
                className="input pr-8"
                placeholder="170"
                value={lb}
                onChange={(e) => handleLb(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">lb</span>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Height (cm)</label>
            <input
              type="number"
              className="input"
              placeholder="175"
              value={heightCm}
              onChange={(e) => handleCm(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              className="input"
              placeholder="75.5"
              value={weightKg}
              onChange={(e) => handleKg(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
