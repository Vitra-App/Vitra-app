interface MacroRingProps {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  size?: number;
}

export function MacroRing({ calories, proteinG, carbsG, fatG, size = 120 }: MacroRingProps) {
  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbsKcal + fatKcal || 1;

  const pPct = (proteinKcal / total) * 100;
  const cPct = (carbsKcal / total) * 100;
  const fPct = (fatKcal / total) * 100;

  const r = 40;
  const circ = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  // Build dash offsets for stacked segments
  const segments = [
    { pct: pPct, color: '#22c55e', label: 'Protein' },
    { pct: cPct, color: '#3b82f6', label: 'Carbs' },
    { pct: fPct, color: '#f59e0b', label: 'Fat' },
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const dash = (s.pct / 100) * circ;
    const gap = circ - dash;
    const rotation = (offset / 100) * 360 - 90;
    offset += s.pct;
    return { ...s, dash, gap, rotation };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="12" />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="12"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={0}
            transform={`rotate(${arc.rotation} ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-900 dark:fill-slate-100" fontSize="16" fontWeight="600">
          {Math.round(calories)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize="11">
          kcal
        </text>
      </svg>

      <div className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600 dark:text-slate-400 w-14">{s.label}</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {s.label === 'Protein' ? proteinG.toFixed(0) : s.label === 'Carbs' ? carbsG.toFixed(0) : fatG.toFixed(0)}g
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
