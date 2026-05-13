'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateInsightPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/insights/daily', { method: 'POST' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Server error (${res.status})`);
          return;
        }
        router.push('/dashboard');
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    })();
  }, [router]);

  if (error) {
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
