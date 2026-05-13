'use client';

interface ProgressBarProps {
  value: number;     // current value
  max: number;       // target value
  color?: string;    // tailwind bg class
  label?: string;
  unit?: string;
  showPercent?: boolean;
}

export function ProgressBar({
  value,
  max,
  color = 'bg-brand-500',
  label,
  unit = 'g',
  showPercent = false,
}: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const over = max > 0 && value > max;

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
          <span className="text-slate-500 dark:text-slate-400">
            {value.toFixed(value < 10 ? 1 : 0)}{unit} / {max}{unit}
            {showPercent && <span className="ml-1 text-slate-400">({pct.toFixed(0)}%)</span>}
          </span>
        </div>
      )}
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill ${over ? 'bg-orange-400' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
