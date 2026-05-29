import { useEffect, useState } from "react";
import api, { CHART } from "@/lib/api";
import useLiveFeed from "@/lib/useLiveFeed";
import { Panel, MetricCard, LiveDot } from "@/components/widgets";
import {
  Smile, Timer, ShieldAlert, PlaneTakeoff, Users, BadgeCheck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
  AreaChart, Area, CartesianGrid,
} from "recharts";

const EVENT_COLOR = {
  delay: "bg-amber-500", weather: "bg-blue-500", congestion: "bg-rose-500",
  recovery: "bg-emerald-500", satisfaction: "bg-violet-500",
};

export default function Overview() {
  const [overview, setOverview] = useState(null);
  const [sat, setSat] = useState(null);
  const { data: feed } = useLiveFeed(4000);
  const [riskHistory, setRiskHistory] = useState([]);

  useEffect(() => {
    api.get("/analytics/overview").then((r) => setOverview(r.data));
    api.get("/analytics/satisfaction").then((r) => setSat(r.data));
  }, []);

  useEffect(() => {
    if (feed?.kpis) {
      setRiskHistory((h) =>
        [...h, { t: feed.timestamp?.slice(11, 19), risk: feed.kpis.operational_risk }].slice(-20)
      );
    }
  }, [feed]);

  const classData = sat?.by_class || [];

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard testid="kpi-satisfaction" label="Satisfaction Rate" value={overview?.satisfaction_rate ?? "—"}
          suffix="%" icon={Smile} accent="text-emerald-600" trend={1} trendLabel="across active network" />
        <MetricCard testid="kpi-ontime" label="On-Time Performance" value={overview?.on_time_performance ?? "—"}
          suffix="%" icon={Timer} accent="text-blue-600" trend={1} trendLabel="arrivals within 15 min" />
        <MetricCard testid="kpi-risk" label="Operational Risk" value={overview?.operational_risk_index ?? "—"}
          suffix="/100" icon={ShieldAlert} accent="text-orange-600" trend={-1} trendLabel="composite exposure" />
        <MetricCard testid="kpi-flights" label="Active Flights" value={feed?.kpis?.active_flights ?? "—"}
          icon={PlaneTakeoff} accent="text-slate-900" trend={1} trendLabel={`${feed?.kpis?.delayed_flights ?? 0} delayed now`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Satisfaction by class */}
        <Panel testid="panel-class-satisfaction" className="lg:col-span-2" title="Satisfaction by Cabin Class"
          subtitle="Share of satisfied passengers per cabin">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={classData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="segment" tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Bar dataKey="satisfaction_rate" name="Satisfaction %" radius={[3, 3, 0, 0]} maxBarSize={70}>
                {classData.map((_, i) => (
                  <Cell key={i} fill={[CHART.blue, CHART.teal, CHART.orange][i % 3]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Live ops risk trend */}
        <Panel testid="panel-live-risk" title="Live Operational Risk" right={<LiveDot />}
          subtitle="Composite risk, updating in real time">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-black text-orange-600">{feed?.kpis?.operational_risk ?? "—"}</span>
            <span className="text-sm text-slate-400">/ 100</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={riskHistory} margin={{ top: 14, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.orange} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHART.orange} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" tick={{ fontSize: 9, fill: CHART.axis }} axisLine={false} tickLine={false} interval="preserveEnd" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Area type="monotone" dataKey="risk" stroke={CHART.orange} strokeWidth={2} fill="url(#riskGrad)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Secondary KPIs + live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <MetricCard testid="kpi-loyal" label="Loyal Flyer Share" value={overview?.loyal_share ?? "—"} suffix="%"
            icon={BadgeCheck} accent="text-teal-600" trend={1} trendLabel="repeat customers" />
          <MetricCard testid="kpi-business" label="Premium Cabin Mix" value={overview?.business_share ?? "—"} suffix="%"
            icon={Users} accent="text-blue-600" trend={1} trendLabel="business class share" />
          <MetricCard testid="kpi-rating" label="Avg Service Rating" value={overview?.avg_service_rating ?? "—"} suffix="/5"
            icon={Smile} accent="text-slate-900" trend={1} trendLabel="across all touchpoints" />
        </div>

        <Panel testid="panel-live-feed" className="lg:col-span-2" title="Live Operational Feed" right={<LiveDot />}
          subtitle="Network events as they happen">
          <div className="space-y-px max-h-[340px] overflow-y-auto -mx-1 px-1">
            {(feed?.events || []).map((ev) => (
              <div key={ev.id} className="feed-enter flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${EVENT_COLOR[ev.kind] || "bg-slate-400"}`} />
                <p className="text-sm text-slate-700 flex-1 leading-snug">{ev.message}</p>
                <span className="font-plex-mono text-[11px] text-slate-400 shrink-0">{ev.time}</span>
              </div>
            ))}
            {!feed && <p className="text-sm text-slate-400 py-6 text-center">Connecting to live feed…</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
