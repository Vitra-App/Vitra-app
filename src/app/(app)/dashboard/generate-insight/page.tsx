'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GenerateInsightPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await fetch('/api/insights/daily', { method: 'POST' });
      router.push('/dashboard');
      router.refresh();
    })();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-pulse">✨</div>
        <p className="text-slate-600 font-medium">Generating your AI nutrition outlook…</p>
        <p className="text-slate-400 text-sm mt-1">This usually takes a few seconds.</p>
      </div>
    </div>
  );
}
