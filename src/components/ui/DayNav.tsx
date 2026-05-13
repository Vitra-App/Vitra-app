"use client";

import { useRef } from "react";

interface Props { dateStr: string; isToday: boolean; }

export function DayNav({ dateStr, isToday }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const date = new Date(dateStr + "T00:00:00Z");
  const todayStr = new Date().toISOString().slice(0, 10);
  const prev = new Date(date); prev.setUTCDate(prev.getUTCDate() - 1);
  const prevStr = prev.toISOString().slice(0, 10);
  const next = new Date(date); next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = next.toISOString().slice(0, 10);
  const canGoForward = dateStr < todayStr;
  const label = isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; if (!val) return;
    window.location.href = val === todayStr ? "/dashboard" : "/dashboard?date=" + val;
  }
  return (
    <div className="flex items-center gap-1">
      <a href={"/dashboard?date=" + prevStr} className="w-9 h-9 flex items-center justify-center rounded-xl text-2xl font-light text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition" aria-label="Previous day">
        &#8249;
      </a>
      <div className="relative">
        <button onClick={() => inputRef.current?.showPicker()} className="text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-[90px] text-center px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition select-none">
          {label}
        </button>
        <input ref={inputRef} type="date" max={todayStr} value={dateStr} onChange={handleDateChange} className="absolute inset-0 opacity-0 pointer-events-none w-full" tabIndex={-1} />
      </div>
      {canGoForward ? (
        <a href={nextStr === todayStr ? "/dashboard" : "/dashboard?date=" + nextStr} className="w-9 h-9 flex items-center justify-center rounded-xl text-2xl font-light text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition" aria-label="Next day">
          &#8250;
        </a>
      ) : (<span className="w-9 h-9" />)}
    </div>
  );
}
