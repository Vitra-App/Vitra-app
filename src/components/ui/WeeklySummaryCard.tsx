'use client';

import { useEffect, useState } from 'react';

interface Props {
  isPro: boolean;
}

export function WeeklySummaryCard({ isPro }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    fetch('/api/insights/weekly')
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? null);
        setGeneratedAt(d.generatedAt ?? null);
        setFetched(true);
      });
  }, []);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/insights/weekly', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }
      setContent(data.content);
      setGeneratedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }

  if (!fetched) return null;

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Weekly Summary</h2>
        {generatedAt && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>

      {content ? (
        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
          {content}
        </div>
      ) : (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No summary yet. Generate one to see how your week went.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={generate}
        disabled={loading || !isPro}
        className="btn-secondary text-sm w-full"
        title={!isPro ? 'Upgrade to Pro for AI weekly summaries' : undefined}
      >
        {loading ? 'Generating…' : !isPro ? '⚡ Pro — Generate Weekly Summary' : '✨ Regenerate Summary'}
      </button>
    </div>
  );
}
