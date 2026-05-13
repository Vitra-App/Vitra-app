'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { HeightWeightInputs } from '@/components/HeightWeightInputs';
import { GoalPicker, type Goal } from '@/components/GoalPicker';
import { calcTargetsFromProfile } from '@/lib/nutrition';

function ageToDOBString(age: string): string | null {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 120) return null;
  const year = new Date().getFullYear() - n;
  return `${year}-01-01`;
}

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise' },
  { value: 'lightly_active', label: 'Lightly Active', desc: '1–3 days/week' },
  { value: 'moderately_active', label: 'Moderately Active', desc: '3–5 days/week' },
  { value: 'very_active', label: 'Very Active', desc: '6–7 days/week' },
  { value: 'extra_active', label: 'Extra Active', desc: 'Physical job or 2× training' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    sex: '',
    age: '',
    heightCm: '',
    weightKg: '',
    goal: '' as Goal | '',
    weeklyWeightChangeKg: '',
    activityLevel: '',
  });

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function canAdvance() {
    if (step === 0) return form.sex && form.age && parseInt(form.age, 10) > 0;
    if (step === 1) return form.heightCm && form.weightKg;
    if (step === 2) {
      if (!form.goal) return false;
      if (form.goal === 'maintain') return true;
      return form.weeklyWeightChangeKg !== '' && parseFloat(form.weeklyWeightChangeKg) !== 0;
    }
    if (step === 3) return form.activityLevel;
    return true;
  }

  async function handleFinish() {
    startTransition(async () => {
      const heightCm = form.heightCm ? parseFloat(form.heightCm) : null;
      const weightKg = form.weightKg ? parseFloat(form.weightKg) : null;
      const weeklyKg = form.weeklyWeightChangeKg !== ''
        ? parseFloat(form.weeklyWeightChangeKg)
        : null;

      // Auto-compute targets from the collected profile.
      let targets: ReturnType<typeof calcTargetsFromProfile> | null = null;
      const ageYears = parseInt(form.age, 10);
      if (
        form.sex && Number.isFinite(ageYears) && ageYears > 0 &&
        heightCm && weightKg
      ) {
        targets = calcTargetsFromProfile({
          sex: form.sex,
          ageYears,
          heightCm,
          weightKg,
          activityLevel: form.activityLevel || 'moderately_active',
          weeklyWeightChangeKg: weeklyKg ?? 0,
        });
      }

      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sex: form.sex,
          dateOfBirth: ageToDOBString(form.age),
          heightCm,
          weightKg,
          goal: form.goal || null,
          weeklyWeightChangeKg: weeklyKg,
          activityLevel: form.activityLevel,
          ...(targets ?? {}),
        }),
      });
      router.push('/dashboard');
    });
  }

  const steps = [
    // Step 0 — basics
    <div key="basics" className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Tell us about yourself</h2>
      <div>
        <label className="label">Sex</label>
        <div className="flex gap-2">
          {['male', 'female', 'other'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set('sex', s)}
              className={`flex-1 py-2 rounded-xl border text-sm font-medium capitalize transition ${form.sex === s ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Age</label>
        <input
          type="number"
          min={1}
          max={120}
          className="input"
          placeholder="e.g. 30"
          value={form.age}
          onChange={(e) => set('age', e.target.value)}
        />
      </div>
    </div>,

    // Step 1 — measurements
    <div key="measurements" className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Your measurements</h2>
      <HeightWeightInputs
        heightCm={form.heightCm}
        weightKg={form.weightKg}
        onChange={({ heightCm, weightKg }) =>
          setForm((f) => ({ ...f, heightCm, weightKg }))
        }
      />
    </div>,

    // Step 2 — goal
    <div key="goal" className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">What&apos;s your main goal?</h2>
      <GoalPicker
        goal={form.goal}
        weeklyWeightChangeKg={form.weeklyWeightChangeKg}
        onChange={({ goal, weeklyWeightChangeKg }) =>
          setForm((f) => ({ ...f, goal, weeklyWeightChangeKg }))
        }
      />
    </div>,

    // Step 3 — activity
    <div key="activity" className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-800">How active are you?</h2>
      <div className="space-y-2">
        {ACTIVITY_LEVELS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => set('activityLevel', a.value)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition ${form.activityLevel === a.value ? 'bg-brand-50 border-brand-400 text-brand-700' : 'bg-white border-slate-200 text-slate-700 hover:border-brand-200'}`}
          >
            <p className="text-sm font-medium">{a.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{a.desc}</p>
          </button>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="Vitra" width={110} height={110} className="mx-auto" priority unoptimized />
          <p className="text-slate-500 text-sm mt-1">Quick setup — just 4 steps</p>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1.5 mb-6 justify-center">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-brand-500 w-8' : 'bg-slate-200 w-4'}`}
            />
          ))}
        </div>

        <div className="card">
          {steps[step]}

          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button className="btn-secondary flex-1" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                className="btn-primary flex-1"
                disabled={!canAdvance()}
                onClick={() => setStep((s) => s + 1)}
              >
                Next
              </button>
            ) : (
              <button
                className="btn-primary flex-1"
                disabled={!canAdvance() || isPending}
                onClick={handleFinish}
              >
                {isPending ? 'Setting up…' : "Let's go! 🚀"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
