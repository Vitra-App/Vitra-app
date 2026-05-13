'use client';

import { useEffect, useState } from 'react';

type Habit = {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
  streak: number;
  lastCheckedDate: string | null;
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function HabitsCard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch('/api/habits')
      .then((r) => r.json())
      .then((data) => {
        setHabits(Array.isArray(data) ? data : []);
        setLoaded(true);
      });
  }, []);

  async function toggle(habit: Habit) {
    const doneToday = habit.lastCheckedDate === todayStr();
    const res = await fetch(`/api/habits/${habit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check: !doneToday }),
    });
    if (res.ok) {
      const updated: Habit = await res.json();
      setHabits((prev) => prev.map((h) => (h.id === habit.id ? updated : h)));
    }
  }

  async function addHabit() {
    if (!newName.trim()) return;
    setAdding(true);
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), category: 'manual' }),
    });
    if (res.ok) {
      const created: Habit = await res.json();
      setHabits((prev) => {
        if (prev.find((h) => h.id === created.id)) return prev;
        return [...prev, created];
      });
      setNewName('');
    }
    setAdding(false);
  }

  async function remove(id: string) {
    await fetch(`/api/habits/${id}`, { method: 'DELETE' });
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  if (!loaded) return null;

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Daily Habits</h2>

      {habits.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No habits yet. Add one below or create from bloodwork insights.
        </p>
      )}

      {habits.length > 0 && (
        <ul className="space-y-2">
          {habits.map((habit) => {
            const done = habit.lastCheckedDate === todayStr();
            return (
              <li key={habit.id} className="flex items-center gap-3">
                <button
                  onClick={() => toggle(habit)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    done
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-slate-300 dark:border-slate-600 hover:border-brand-400'
                  }`}
                  aria-label={done ? 'Uncheck habit' : 'Check habit'}
                >
                  {done && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5l2.5 2.5L8 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      done
                        ? 'text-slate-400 dark:text-slate-500 line-through'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {habit.icon && <span className="mr-1">{habit.icon}</span>}
                    {habit.name}
                  </p>
                </div>

                {habit.streak >= 2 && (
                  <span className="text-xs text-amber-500 font-medium shrink-0">
                    🔥 {habit.streak}d
                  </span>
                )}

                <button
                  onClick={() => remove(habit.id)}
                  className="text-slate-300 dark:text-slate-600 hover:text-red-400 text-base leading-none shrink-0"
                  aria-label="Remove habit"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
        <input
          className="input flex-1 text-sm py-1.5"
          placeholder="New habit..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addHabit()}
        />
        <button
          className="btn-primary text-xs py-1.5 px-3"
          onClick={addHabit}
          disabled={adding || !newName.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
