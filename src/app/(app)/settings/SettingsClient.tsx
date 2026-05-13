'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { UserProfile } from '@prisma/client';
import { HeightWeightInputs } from '@/components/HeightWeightInputs';
import { GoalPicker, type Goal } from '@/components/GoalPicker';
import { ageFromDOB, calcTargetsFromProfile } from '@/lib/nutrition';

interface Props {
  user: { name: string | null; email: string | null; image: string | null };
  profile: UserProfile | null;
  tier: string;
  stripeEnabled: boolean;
}

/**
 * Convert an age (in years) to a stable ISO date string the API expects for
 * `dateOfBirth`. Anchored to Jan 1 of the implied birth year so it round-trips
 * cleanly through `ageFromDOB` for the rest of the calendar year.
 */
function ageToDOBString(age: string): string | null {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 120) return null;
  const year = new Date().getFullYear() - n;
  return `${year}-01-01`;
}

export function SettingsClient({ user, profile, tier, stripeEnabled }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [dark, setDark] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const upgradedParam = searchParams.get('upgraded');
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(upgradedParam === '1');

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  }

  const [form, setForm] = useState({
    name: user.name ?? '',
    sex: profile?.sex ?? '',
    age: profile?.dateOfBirth
      ? String(ageFromDOB(new Date(profile.dateOfBirth)))
      : '',
    heightCm: String(profile?.heightCm ?? ''),
    weightKg: String(profile?.weightKg ?? ''),
    goal: ((profile?.goal as Goal | undefined) ?? '') as Goal | '',
    weeklyWeightChangeKg: profile?.weeklyWeightChangeKg != null ? String(profile.weeklyWeightChangeKg) : '',
    activityLevel: profile?.activityLevel ?? '',
    caloricTarget: String(profile?.caloricTarget ?? ''),
    proteinTargetG: String(profile?.proteinTargetG ?? ''),
    carbTargetG: String(profile?.carbTargetG ?? ''),
    fatTargetG: String(profile?.fatTargetG ?? ''),
  });

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  // Auto-recompute calorie & macro targets whenever the underlying profile
  // inputs change. Always runs (including the first render) so the displayed
  // targets always reflect the current weight / goal / activity / rate.
  useEffect(() => {
    const heightCm = parseFloat(form.heightCm);
    const weightKg = parseFloat(form.weightKg);
    const ageYears = parseInt(form.age, 10);
    if (
      !form.sex ||
      !Number.isFinite(ageYears) || ageYears <= 0 ||
      !Number.isFinite(heightCm) || heightCm <= 0 ||
      !Number.isFinite(weightKg) || weightKg <= 0
    ) {
      return;
    }
    const weeklyKg = form.weeklyWeightChangeKg !== ''
      ? parseFloat(form.weeklyWeightChangeKg)
      : 0;
    const t = calcTargetsFromProfile({
      sex: form.sex,
      ageYears,
      heightCm,
      weightKg,
      // Sensible defaults so calories compute even before activity/goal are set.
      activityLevel: form.activityLevel || 'moderately_active',
      weeklyWeightChangeKg: Number.isFinite(weeklyKg) ? weeklyKg : 0,
    });
    setForm((f) => ({
      ...f,
      caloricTarget: String(t.caloricTarget),
      proteinTargetG: String(t.proteinTargetG),
      carbTargetG: String(t.carbTargetG),
      fatTargetG: String(t.fatTargetG),
    }));
  }, [
    form.sex,
    form.age,
    form.heightCm,
    form.weightKg,
    form.activityLevel,
    form.goal,
    form.weeklyWeightChangeKg,
  ]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          sex: form.sex,
          dateOfBirth: ageToDOBString(form.age),
          heightCm: form.heightCm ? parseFloat(form.heightCm) : null,
          weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
          goal: form.goal || null,
          weeklyWeightChangeKg: form.weeklyWeightChangeKg !== ''
            ? parseFloat(form.weeklyWeightChangeKg)
            : null,
          activityLevel: form.activityLevel,
          caloricTarget: form.caloricTarget ? parseInt(form.caloricTarget) : null,
          proteinTargetG: form.proteinTargetG ? parseFloat(form.proteinTargetG) : null,
          carbTargetG: form.carbTargetG ? parseFloat(form.carbTargetG) : null,
          fatTargetG: form.fatTargetG ? parseFloat(form.fatTargetG) : null,
        }),
      });
      // Pull the server-derived targets back into the rendered profile.
      router.refresh();
      setSaved(true);
    });
  }

  async function handleUpgrade() {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleManage() {
    setStripeLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setStripeLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>

      {showUpgradedBanner && (
        <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700/50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-brand-800 dark:text-brand-300">🎉 Welcome to Pro! AI features are now unlocked.</p>
          <button onClick={() => setShowUpgradedBanner(false)} className="text-brand-400 hover:text-brand-600 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Subscription badge */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Subscription</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tier === 'pro' ? 'Pro — all AI features enabled' : 'Free tier — upgrade for unlimited AI insights'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${tier === 'pro' ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
            {tier.toUpperCase()}
          </span>
        </div>
        {stripeEnabled && tier !== 'pro' && (
          <button
            onClick={handleUpgrade}
            disabled={stripeLoading}
            className="btn-primary w-full text-sm"
          >
            {stripeLoading ? 'Loading…' : '⚡ Upgrade to Pro'}
          </button>
        )}
        {stripeEnabled && tier === 'pro' && (
          <button
            onClick={handleManage}
            disabled={stripeLoading}
            className="btn-secondary w-full text-sm"
          >
            {stripeLoading ? 'Loading…' : 'Manage Subscription'}
          </button>
        )}
        {!stripeEnabled && tier !== 'pro' && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Payments not yet configured — all features are available for free during development.
          </p>
        )}
      </div>

      <form onSubmit={handleSave} className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Profile</h2>

        <div>
          <label className="label">Display Name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div>
          <label className="label">Email</label>
          <input className="input bg-slate-50 dark:bg-slate-700/30 text-slate-400 dark:text-slate-500" value={user.email ?? ''} disabled />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Sex</label>
            <select className="input" value={form.sex} onChange={(e) => set('sex', e.target.value)}>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
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
        </div>

        <HeightWeightInputs
          heightCm={form.heightCm}
          weightKg={form.weightKg}
          onChange={({ heightCm, weightKg }) => {
            setForm((f) => ({ ...f, heightCm, weightKg }));
            setSaved(false);
          }}
        />

        <div>
          <label className="label">Goal</label>
          <GoalPicker
            goal={form.goal}
            weeklyWeightChangeKg={form.weeklyWeightChangeKg}
            onChange={({ goal, weeklyWeightChangeKg }) => {
              setForm((f) => ({ ...f, goal, weeklyWeightChangeKg }));
              setSaved(false);
            }}
          />
        </div>

        <div>
          <label className="label">Activity Level</label>
          <select className="input" value={form.activityLevel} onChange={(e) => set('activityLevel', e.target.value)}>
            <option value="">Select…</option>
            <option value="sedentary">Sedentary (desk job, little exercise)</option>
            <option value="lightly_active">Lightly Active (1–3 days/week)</option>
            <option value="moderately_active">Moderately Active (3–5 days/week)</option>
            <option value="very_active">Very Active (6–7 days/week)</option>
            <option value="extra_active">Extra Active (physical job or 2x training)</option>
          </select>
        </div>

        <div className="pt-2">
          <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">Daily Targets</h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            Auto-calculated from your weight, height, age, sex, activity level, and goal.
          </p>
          {(!form.sex || !form.age || !form.heightCm || !form.weightKg) && (
            <p className="text-[11px] text-amber-600 mt-1">
              Fill in sex, age, height, and weight above to auto-calculate.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Calories (kcal)</label>
            <input
              type="number"
              className="input bg-slate-50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400"
              value={form.caloricTarget}
              readOnly
            />
          </div>
          <div>
            <label className="label">Protein (g)</label>
            <input
              type="number"
              className="input bg-slate-50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400"
              value={form.proteinTargetG}
              readOnly
            />
          </div>
          <div>
            <label className="label">Carbs (g)</label>
            <input
              type="number"
              className="input bg-slate-50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400"
              value={form.carbTargetG}
              readOnly
            />
          </div>
          <div>
            <label className="label">Fat (g)</label>
            <input
              type="number"
              className="input bg-slate-50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400"
              value={form.fatTargetG}
              readOnly
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600">✓ Saved!</span>}
        </div>
      </form>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Appearance</h2>
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-secondary w-full flex items-center justify-between"
        >
          <span>{dark ? '🌙 Dark mode' : '☀️ Light mode'}</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">{dark ? 'On' : 'Off'}</span>
        </button>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Account</h2>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="btn-secondary text-red-600 border-red-100 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
