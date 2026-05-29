import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Panel({ title, subtitle, right, children, className, testid }) {
  return (
    <section
      data-testid={testid}
      className={cn(
        "bg-white border border-slate-200 rounded-sm fade-up",
        className
      )}
    >
      {(title || right) && (
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            {title && (
              <h3 className="font-display text-sm font-bold tracking-tight text-slate-900">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {right}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function MetricCard({ label, value, suffix, trend, trendLabel, icon: Icon, accent = "text-slate-900", testid }) {
  const up = typeof trend === "number" ? trend >= 0 : null;
  return (
    <div
      data-testid={testid}
      className="bg-white border border-slate-200 rounded-sm p-5 fade-up hover:border-slate-300 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-slate-300" />}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className={cn("font-display text-3xl font-black tracking-tighter", accent)}>
          {value}
        </span>
        {suffix && <span className="text-sm font-semibold text-slate-400">{suffix}</span>}
      </div>
      {trendLabel && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {up !== null &&
            (up ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
            ))}
          <span className={cn(up === null ? "text-slate-400" : up ? "text-emerald-600" : "text-rose-600")}>
            {trendLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export function LiveDot({ label = "LIVE" }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
      <span className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />
      {label}
    </span>
  );
}

export function RiskGauge({ value, label }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 60 ? "#DC2626" : v >= 35 ? "#D97706" : "#16A34A";
  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="relative w-28 h-28 rounded-full"
        style={{ background: `conic-gradient(${color} ${v * 3.6}deg, #EEF2F6 0deg)` }}
      >
        <div className="absolute inset-2 bg-white rounded-full flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-black text-slate-900">{v}</span>
          <span className="text-[10px] uppercase tracking-widest text-slate-400">index</span>
        </div>
      </div>
      <span className="mt-3 text-xs font-semibold text-slate-500">{label}</span>
    </div>
  );
}

const PRIORITY_STYLES = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function PriorityBadge({ level = "medium" }) {
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-sm",
        PRIORITY_STYLES[level] || PRIORITY_STYLES.medium
      )}
    >
      {level}
    </span>
  );
}
