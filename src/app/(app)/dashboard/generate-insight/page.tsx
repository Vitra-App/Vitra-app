'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateInsightPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'confirm' | 'loading' | 'error'>('confirm');
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setStatus('loading');
    try {
      const res = await fetch('/api/insights/daily', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Server error (${res.status})`);
        setStatus('error');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus('error');
    }
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-slate-700 dark:text-slate-300 font-medium">Failed to generate insight</p>
          <p className="text-red-500 text-sm mt-2 max-w-sm">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="btn-primary mt-4 text-sm">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">✨</div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Generating your AI nutrition outlook…</p>
          <p className="text-slate-400 text-sm mt-1">This usually takes a few seconds.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">✨</div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200">Generate Today&apos;s Outlook</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your AI nutrition coach analyses everything you&apos;ve logged today.</p>
        </div>

        <div className="card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 mb-4">
          <div className="flex gap-3">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">You only get one outlook per day</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Make sure all your meals are logged before generating — you won&apos;t be able to regenerate until tomorrow.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-secondary flex-1 text-sm">
            Go back
          </button>
          <button onClick={handleGenerate} className="btn-primary flex-1 text-sm">
            Generate now
          </button>
        </div>
      </div>
    </div>
  );
}
}
