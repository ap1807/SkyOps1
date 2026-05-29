import useLiveFeed from "@/lib/useLiveFeed";
import { Panel, LiveDot, RiskGauge } from "@/components/widgets";
import { Cloud, Wind, AlertTriangle, Plane } from "lucide-react";

const EVENT_COLOR = {
  delay: "bg-amber-500", weather: "bg-blue-500", congestion: "bg-rose-500",
  recovery: "bg-emerald-500", satisfaction: "bg-violet-500",
};

const STATUS_STYLE = {
  "On Time": "text-emerald-700 bg-emerald-50",
  Boarding: "text-blue-700 bg-blue-50",
  Departed: "text-slate-600 bg-slate-100",
  Delayed: "text-rose-700 bg-rose-50",
};

export default function Disruption() {
  const { data: feed } = useLiveFeed(3500);
  const k = feed?.kpis;

  return (
    <div className="space-y-6">
      {/* Risk gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Panel testid="panel-risk-gauges" className="lg:col-span-2" title="Operational Risk Posture" right={<LiveDot />}>
          <div className="grid grid-cols-3 gap-2">
            <RiskGauge value={Math.round(k?.operational_risk ?? 0)} label="Operational" />
            <RiskGauge value={Math.round(k?.avg_congestion ?? 0)} label="Congestion" />
            <RiskGauge value={Math.round(k?.weather_risk ?? 0)} label="Weather" />
          </div>
        </Panel>

        <StatCard icon={Plane} label="Delayed Flights" value={k?.delayed_flights ?? "—"} tone="rose" sub={`of ${k?.active_flights ?? 0} active`} />
        <StatCard icon={Wind} label="On-Time Rate" value={`${k?.on_time_pct ?? "—"}%`} tone="emerald" sub="within 15 min" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Airport congestion */}
        <Panel testid="panel-congestion" title="Airport Congestion Index" subtitle="Live hub pressure ranking">
          <div className="space-y-2.5">
            {(feed?.congestion || []).slice(0, 8).map((c) => {
              const tone = c.index >= 70 ? "bg-rose-500" : c.index >= 45 ? "bg-amber-500" : "bg-emerald-500";
              return (
                <div key={c.airport} className="flex items-center gap-3">
                  <span className="font-plex-mono text-sm font-semibold text-slate-900 w-10">{c.airport}</span>
                  <span className="text-xs text-slate-400 w-24 truncate">{c.city}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                    <div className={`h-full ${tone} transition-all duration-500`} style={{ width: `${c.index}%` }} />
                  </div>
                  <span className="font-plex-mono text-xs text-slate-600 w-10 text-right">{c.index}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Live feed */}
        <Panel testid="panel-disruption-feed" title="Disruption Stream" right={<LiveDot />} subtitle="Network events live">
          <div className="space-y-px max-h-[330px] overflow-y-auto -mx-1 px-1">
            {(feed?.events || []).map((ev) => (
              <div key={ev.id} className="feed-enter flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${EVENT_COLOR[ev.kind] || "bg-slate-400"}`} />
                <p className="text-sm text-slate-700 flex-1 leading-snug">{ev.message}</p>
                <span className="font-plex-mono text-[11px] text-slate-400 shrink-0">{ev.time}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Weather snapshot */}
        <Panel testid="panel-weather" title="Active Flight Weather" subtitle="Conditions across the fleet">
          <div className="space-y-2">
            {(feed?.flights || []).slice(0, 8).map((f, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <Cloud className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-plex-mono">{f.flight}</span>
                  <span className="text-slate-400">{f.origin}→{f.dest}</span>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-sm ${["Thunderstorm", "Snow", "Fog"].includes(f.weather) ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                  {f.weather}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Flights table */}
      <Panel testid="panel-flights-table" title="Active Flight Board" right={<LiveDot />} subtitle="Real-time flight status">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="text-left font-semibold py-2 px-3">Flight</th>
                <th className="text-left font-semibold py-2 px-3">Airline</th>
                <th className="text-left font-semibold py-2 px-3">Route</th>
                <th className="text-right font-semibold py-2 px-3">Delay</th>
                <th className="text-right font-semibold py-2 px-3">Load</th>
                <th className="text-right font-semibold py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(feed?.flights || []).map((f, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 font-plex-mono font-semibold text-slate-900">{f.flight}</td>
                  <td className="py-2 px-3 text-slate-600">{f.airline}</td>
                  <td className="py-2 px-3 text-slate-600">{f.origin_city} → {f.dest_city}</td>
                  <td className="py-2 px-3 text-right font-plex-mono text-slate-700">{f.delay}m</td>
                  <td className="py-2 px-3 text-right font-plex-mono text-slate-700">{Math.round(f.load_factor * 100)}%</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-sm ${STATUS_STYLE[f.status] || "bg-slate-100 text-slate-600"}`}>
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, sub }) {
  const tones = {
    rose: "text-rose-600", emerald: "text-emerald-600", amber: "text-amber-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-sm p-5 flex flex-col justify-center fade-up">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <Icon className="w-4 h-4 text-slate-300" />
      </div>
      <span className={`mt-3 font-display text-4xl font-black tracking-tighter ${tones[tone]}`}>{value}</span>
      <span className="mt-1 text-xs text-slate-400">{sub}</span>
    </div>
  );
}
