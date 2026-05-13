'use client';

import { useEffect, useState } from 'react';

const MODE_KEY = 'dashboardMode';

function readMode(): 'minimal' | 'advanced' {
  if (typeof window === 'undefined') return 'advanced';
  return (localStorage.getItem(MODE_KEY) as 'minimal' | 'advanced') ?? 'advanced';
}

export function AdvancedOnly({ children }: { children: React.ReactNode }) {
  // Default true (advanced) so server-rendered content doesn't flash on first paint
  const [isMinimal, setIsMinimal] = useState(false);

  useEffect(() => {
    setIsMinimal(readMode() === 'minimal');
    function onModeChange() {
      setIsMinimal(readMode() === 'minimal');
    }
    window.addEventListener('dashboardModeChange', onModeChange);
    return () => window.removeEventListener('dashboardModeChange', onModeChange);
  }, []);

  if (isMinimal) return null;
  return <>{children}</>;
}

export function ModeToggle() {
  const [mode, setMode] = useState<'minimal' | 'advanced'>('advanced');

  useEffect(() => {
    setMode(readMode());
    function onModeChange() {
      setMode(readMode());
    }
    window.addEventListener('dashboardModeChange', onModeChange);
    return () => window.removeEventListener('dashboardModeChange', onModeChange);
  }, []);

  function toggle() {
    const next = mode === 'minimal' ? 'advanced' : 'minimal';
    localStorage.setItem(MODE_KEY, next);
    setMode(next);
    window.dispatchEvent(new CustomEvent('dashboardModeChange'));
  }

  return (
    <button
      onClick={toggle}
      className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-1 transition-colors"
    >
      {mode === 'minimal' ? '▦ Advanced' : '◼ Simple'}
    </button>
  );
}
