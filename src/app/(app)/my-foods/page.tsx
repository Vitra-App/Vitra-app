'use client';

import { useEffect, useState } from 'react';

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
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  densityGPerMl: number | null;
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

function foodToForm(f: Food): FormState {
  return {
    name: f.name,
    brand: f.brand ?? '',
    servingSize: f.servingSize,
    servingWeightG: String(f.servingWeightG),
    densityGPerMl: f.densityGPerMl != null ? String(f.densityGPerMl) : '',
    calories: String(f.calories),
    proteinG: String(f.proteinG),
    carbsG: String(f.carbsG),
    fatG: String(f.fatG),
    fiberG: f.fiberG != null ? String(f.fiberG) : '',
    sugarG: f.sugarG != null ? String(f.sugarG) : '',
    sodiumMg: f.sodiumMg != null ? String(f.sodiumMg) : '',
  };
}

export default function MyFoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/foods/mine');
    if (res.ok) setFoods(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function startEdit(f: Food) {
    setEditingId(f.id);
    setForm(foodToForm(f));
    setShowForm(false);
    setError(null);
    setTimeout(() => document.getElementById('edit-form-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
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
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/foods/mine/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Failed to update food.');
        return;
      }
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this food?')) return;
    const res = await fetch(`/api/foods/mine/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || 'Failed to delete.');
      return;
    }
    if (editingId === id) cancelEdit();
    await load();
  }

  const foodForm = (onSubmit: (e: React.FormEvent) => Promise<void>, isEdit: boolean) => (
    <form onSubmit={onSubmit} className="card space-y-4" id={isEdit ? 'edit-form-top' : undefined}>
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {isEdit ? 'Edit Food' : 'New Custom Food'}
      </h2>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{error}</div>
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
          <input className="input" value={form.servingSize} onChange={(e) => setField('servingSize', e.target.value)} placeholder="1 cup, 1 sliceâ€¦" />
        </Field>
        <Field label="Serving weight (g) *">
          <input type="number" className="input" min={0} step="0.1" value={form.servingWeightG} onChange={(e) => setField('servingWeightG', e.target.value)} />
        </Field>
        <Field label="Density (g/mL)" hint="optional, for volume conv.">
          <input type="number" className="input" min={0} step="0.01" value={form.densityGPerMl} onChange={(e) => setField('densityGPerMl', e.target.value)} />
        </Field>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Nutrition per serving</p>
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

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Savingâ€¦' : isEdit ? 'Save Changes' : 'Save Food'}
        </button>
        <button type="button" className="btn-secondary" onClick={isEdit ? cancelEdit : () => setShowForm(false)}>
          Cancel
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Foods</h1>
          <p className="text-sm text-slate-500 mt-0.5">Custom foods you&apos;ve created. They appear in search alongside the main database.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setError(null); cancelEdit(); setShowForm((v) => !v); }}
        >
          {showForm ? 'Cancel' : '+ New Food'}
        </button>
      </div>

      {showForm && foodForm(handleCreate, false)}
      {editingId && foodForm(handleUpdate, true)}

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
          Your Foods <span className="text-slate-400 font-normal">({foods.length})</span>
        </h2>

        {loading ? (
          <p className="text-sm text-slate-400 py-4 text-center">Loadingâ€¦</p>
        ) : foods.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            No custom foods yet. Click <span className="font-medium text-slate-600">+ New Food</span> to create one.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {foods.map((f) => (
              <li key={f.id} className={`py-3 flex items-center justify-between gap-3 ${editingId === f.id ? 'opacity-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {f.name}
                    {f.brand && <span className="text-slate-400 font-normal"> Â· {f.brand}</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {f.servingSize} ({f.servingWeightG} g) Â· {Math.round(f.calories)} kcal Â·
                    P {f.proteinG.toFixed(0)} / C {f.carbsG.toFixed(0)} / F {f.fatG.toFixed(0)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => editingId === f.id ? cancelEdit() : startEdit(f)}
                    className="text-xs text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 px-2 py-1"
                  >
                    {editingId === f.id ? 'Cancel' : 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="text-xs text-slate-400 hover:text-red-600 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
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
        {hint && <span className="text-slate-400 font-normal ml-1">â€” {hint}</span>}
      </span>
      {children}
    </label>
  );
}
