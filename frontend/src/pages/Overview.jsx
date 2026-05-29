import { CHART } from "@/lib/api";
import usePulse from "@/lib/usePulse";
import { Panel, MetricCard, LiveDot } from "@/components/widgets";
import {
  Smile, Timer, ShieldAlert, PlaneTakeoff, Users, BadgeCheck, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  AreaChart, Area, CartesianGrid, Line, ComposedChart,
} from "recharts";

const EVENT_COLOR = {
  delay: "bg-amber-500", weather: "bg-blue-500", congestion: "bg-rose-500",
  recovery: "bg-emerald-500", satisfaction: "bg-violet-500",
};

export default function Overview() {
  const { pulse, updatedAt } = usePulse(3000);
  const k = pulse?.kpis;
  const classData = pulse?.by_class || [];
  const history = pulse?.history || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <LiveDot label="REAL-TIME · STREAMING" />
        <span className="text-xs text-slate-400 font-plex-mono">
          {updatedAt ? `updated ${updatedAt.toLocaleTimeString()}` : "connecting…"}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard testid="kpi-satisfaction" label="Satisfaction Rate" value={k?.satisfaction_rate ?? "—"}
          suffix="%" icon={Smile} accent="text-emerald-600" trend={1} trendLabel="live network sentiment" />
        <MetricCard testid="kpi-ontime" label="On-Time Performance" value={k?.on_time_performance ?? "—"}
          suffix="%" icon={Timer} accent="text-blue-600" trend={1} trendLabel="arrivals within 15 min" />
        <MetricCard testid="kpi-risk" label="Operational Risk" value={k?.operational_risk_index ?? "—"}
          suffix="/100" icon={ShieldAlert} accent="text-orange-600" trend={-1} trendLabel="composite exposure" />
        <MetricCard testid="kpi-flights" label="Active Flights" value={k?.active_flights ?? "—"}
          icon={PlaneTakeoff} accent="text-slate-900" trend={1} trendLabel={`${k?.delayed_flights ?? 0} delayed now`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live satisfaction vs risk trend */}
        <Panel testid="panel-live-trend" className="lg:col-span-2" title="Live Performance Trend"
          right={<LiveDot />} subtitle="Satisfaction vs operational risk, streaming server-side">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={history} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.teal} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 9, fill: CHART.axis }} axisLine={false} tickLine={false} interval="preserveEnd" minTickGap={28} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Area type="monotone" dataKey="satisfaction" name="Satisfaction %" stroke={CHART.teal} strokeWidth={2} fill="url(#satGrad)" isAnimationActive={false} />
              <Line type="monotone" dataKey="risk" name="Risk Index" stroke={CHART.orange} strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Panel>

        {/* Satisfaction by class */}
        <Panel testid="panel-class-satisfaction" title="Satisfaction by Cabin"
          subtitle="Live share of satisfied passengers">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={classData} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="segment" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Bar dataKey="satisfaction_rate" name="Satisfaction %" radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                {classData.map((_, i) => (
                  <Cell key={i} fill={[CHART.blue, CHART.teal, CHART.orange][i % 3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Secondary KPIs + live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <MetricCard testid="kpi-loyal" label="Loyal Flyer Share" value={k?.loyal_share ?? "—"} suffix="%"
            icon={BadgeCheck} accent="text-teal-600" trend={1} trendLabel="repeat customers" />
          <MetricCard testid="kpi-business" label="Premium Cabin Mix" value={k?.business_share ?? "—"} suffix="%"
            icon={Users} accent="text-blue-600" trend={1} trendLabel="business class share" />
          <MetricCard testid="kpi-rating" label="Avg Service Rating" value={k?.avg_service_rating ?? "—"} suffix="/5"
            icon={Activity} accent="text-slate-900" trend={1} trendLabel="across all touchpoints" />
        </div>

        <Panel testid="panel-live-feed" className="lg:col-span-2" title="Live Operational Feed" right={<LiveDot />}
          subtitle="Network events as they happen">
          <div className="space-y-px max-h-[340px] overflow-y-auto -mx-1 px-1">
            {(pulse?.events || []).map((ev) => (
              <div key={ev.id} className="feed-enter flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${EVENT_COLOR[ev.kind] || "bg-slate-400"}`} />
                <p className="text-sm text-slate-700 flex-1 leading-snug">{ev.message}</p>
                <span className="font-plex-mono text-[11px] text-slate-400 shrink-0">{ev.time}</span>
              </div>
            ))}
            {!pulse && <p className="text-sm text-slate-400 py-6 text-center">Connecting to live feed…</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
