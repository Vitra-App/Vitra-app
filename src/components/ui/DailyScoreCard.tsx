import type { DailyScore } from '@/lib/nutrition';

interface Props {
  result: DailyScore;
}

function tone(score: number): { ring: string; text: string; bg: string } {
  if (score >= 9) return { ring: 'stroke-green-500', text: 'text-green-600', bg: 'bg-green-50' };
  if (score >= 7.5) return { ring: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (score >= 6) return { ring: 'stroke-brand-500', text: 'text-brand-600', bg: 'bg-brand-50' };
  if (score >= 4) return { ring: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
  return { ring: 'stroke-rose-500', text: 'text-rose-600', bg: 'bg-rose-50' };
}

export function DailyScoreCard({ result }: Props) {
  const { score, label, breakdown } = result;
  const t = tone(score);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const pct = score / 10;
  const offset = circumference * (1 - pct);

  return (
    <div className="card">
      <div className="flex items-center gap-5">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="92" height="92" viewBox="0 0 92 92">
            <circle
              cx="46" cy="46" r={radius}
              className="stroke-slate-100 dark:stroke-slate-700"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="46" cy="46" r={radius}
              className={t.ring}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 46 46)"
              style={{ transition: 'stroke-dashoffset 400ms ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold leading-none ${t.text}`}>
              {score.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">/ 10</span>
          </div>
        </div>

        {/* Summary */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Today&apos;s Diet Score</p>
          <p className={`text-lg font-semibold ${t.text}`}>{label}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            How balanced your day was vs. your targets.
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {breakdown.map((b) => {
          const ratio = b.max > 0 ? b.score / b.max : 0;
          const barColor =
            ratio >= 0.85 ? 'bg-green-400' :
            ratio >= 0.5 ? 'bg-amber-400' :
            'bg-rose-400';
          return (
            <li key={b.name} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-600 dark:text-slate-300">{b.name}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {b.score.toFixed(1)} / {b.max}
                </span>
              </div>
              <div className="h-1.5 mt-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all`}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{b.note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
