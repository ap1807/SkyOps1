import { useEffect, useState } from "react";
import api, { CHART } from "@/lib/api";
import { Panel } from "@/components/widgets";
import { TrendingUp, TrendingDown, Lightbulb, FlaskConical } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, CartesianGrid,
} from "recharts";

export default function Satisfaction() {
  const [drivers, setDrivers] = useState([]);
  const [conditional, setConditional] = useState([]);
  const [ages, setAges] = useState([]);
  const [sat, setSat] = useState(null);
  const [findings, setFindings] = useState([]);

  useEffect(() => {
    api.get("/analytics/drivers").then((r) => setDrivers(r.data.drivers.slice(0, 8)));
    api.get("/analytics/conditional").then((r) => setConditional(r.data.insights));
    api.get("/analytics/age-distribution").then((r) => setAges(r.data.bands));
    api.get("/analytics/satisfaction").then((r) => setSat(r.data));
    api.get("/analytics/significance").then((r) => setFindings(r.data.findings));
  }, []);

  const donut = sat
    ? [
        { name: "Satisfied", value: sat.overall.satisfied, color: CHART.teal },
        { name: "Dissatisfied", value: sat.overall.dissatisfied, color: CHART.orange },
      ]
    : [];
  const total = sat ? sat.overall.satisfied + sat.overall.dissatisfied : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Drivers */}
        <Panel testid="panel-drivers" className="lg:col-span-2" title="Top Satisfaction Drivers"
          subtitle="Service touchpoints most strongly linked to happy passengers">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={drivers} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }}
                formatter={(v) => [`${v} impact`, "Influence"]} />
              <Bar dataKey="impact" radius={[0, 3, 3, 0]} maxBarSize={20}>
                {drivers.map((_, i) => (
                  <Cell key={i} fill={CHART.blue} fillOpacity={1 - i * 0.07} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Donut */}
        <Panel testid="panel-split" title="Satisfaction Split" subtitle={`${total.toLocaleString()} passengers analysed`}>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donut} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                  {donut.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-display text-3xl font-black text-slate-900">
                {total ? Math.round((sat.overall.satisfied / total) * 100) : "—"}%
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400">satisfied</span>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {donut.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} /> {d.name}
                </span>
                <span className="font-plex-mono text-slate-900">{d.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conditional insights */}
        <Panel testid="panel-conditional" title="Conditional Insights"
          subtitle="How satisfaction shifts under specific conditions">
          <div className="space-y-2.5">
            {conditional.map((c) => (
              <div key={c.condition} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-sm">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.condition}</p>
                  <p className="text-xs text-slate-400">{c.sample.toLocaleString()} passengers</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-lg font-black text-slate-900">{c.probability}%</div>
                  <div className={`text-xs font-semibold flex items-center justify-end gap-1 ${c.lift >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {c.lift >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {c.lift >= 0 ? "+" : ""}{c.lift} pts
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Age distribution */}
        <Panel testid="panel-age" title="Satisfaction by Age Band" subtitle="Experience across demographics">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ages} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="band" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Bar dataKey="satisfaction_rate" name="Satisfaction %" fill={CHART.teal} radius={[3, 3, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Significance findings */}
      <Panel testid="panel-findings" title="Statistical Intelligence"
        subtitle="High-confidence patterns detected across the network"
        right={<span className="flex items-center gap-1.5 text-xs text-slate-400"><FlaskConical className="w-3.5 h-3.5" /> validated</span>}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {findings.map((f) => (
            <div key={f.title} className="border border-slate-200 rounded-sm p-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                {f.significant && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm">
                    {f.confidence}% confidence
                  </span>
                )}
              </div>
              <h4 className="mt-2.5 text-sm font-semibold text-slate-900 leading-snug">{f.title}</h4>
              <p className="mt-1.5 font-plex-mono text-sm text-blue-600">{f.metric}</p>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">{f.detail}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
