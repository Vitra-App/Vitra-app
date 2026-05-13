interface AIInsightCardProps {
  content: string;
  generatedAt?: Date | string;
  isLoading?: boolean;
}

export function AIInsightCard({ content, generatedAt, isLoading }: AIInsightCardProps) {
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-base">
          ✨
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">AI Nutrition Outlook</h3>
            {generatedAt && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 rounded bg-slate-100 dark:bg-slate-700 w-full" />
              <div className="h-3 rounded bg-slate-100 dark:bg-slate-700 w-5/6" />
              <div className="h-3 rounded bg-slate-100 dark:bg-slate-700 w-4/6" />
            </div>
          ) : (
            <ul className="space-y-2">
              {content.split('\n').filter(l => l.trim()).map((line, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-300 leading-snug">{line.trim()}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
