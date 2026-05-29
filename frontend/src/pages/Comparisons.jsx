import { useEffect, useState } from "react";
import api, { CHART } from "@/lib/api";
import { Panel, LiveDot } from "@/components/widgets";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid,
} from "recharts";

const DIMS = [
  { value: "class", label: "Cabin Class" },
  { value: "travel_type", label: "Travel Purpose" },
  { value: "customer_type", label: "Customer Type" },
  { value: "gender", label: "Gender" },
];

export default function Comparisons() {
  const [dim, setDim] = useState("class");
  const [data, setData] = useState(null);
  const [findings, setFindings] = useState([]);

  useEffect(() => {
    const load = () => api.get(`/analytics/compare?dimension=${dim}`).then((r) => setData(r.data));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [dim]);

  useEffect(() => {
    const load = () => api.get("/analytics/significance").then((r) => setFindings(r.data.findings));
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);

  const segs = data?.segments || [];

  return (
    <div className="space-y-6">
      <LiveDot label="LIVE COMPARISON" />
      <Panel testid="panel-compare" title="Segment Comparison"
        subtitle="Benchmark satisfaction and delays across operational segments"
        right={
          <Select value={dim} onValueChange={setDim}>
            <SelectTrigger data-testid="select-dimension" className="w-44 rounded-sm h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DIMS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={segs} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="segment" tick={{ fontSize: 12, fill: CHART.axis }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} unit="%" />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} unit="m" />
            <Tooltip cursor={{ fill: "#F1F5F9" }} contentStyle={{ borderRadius: 4, border: "1px solid #E2E8F0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="satisfaction_rate" name="Satisfaction %" fill={CHART.blue} radius={[3, 3, 0, 0]} maxBarSize={48} />
            <Bar yAxisId="r" dataKey="avg_delay" name="Avg Delay (min)" fill={CHART.orange} radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel testid="panel-compare-table" title="Segment Breakdown" className="lg:col-span-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="text-left font-semibold py-2">Segment</th>
                <th className="text-right font-semibold py-2">Sat %</th>
                <th className="text-right font-semibold py-2">Pax</th>
              </tr>
            </thead>
            <tbody>
              {segs.map((s) => (
                <tr key={s.segment} className="border-b border-slate-50">
                  <td className="py-2.5 text-slate-700 font-medium">{s.segment}</td>
                  <td className="py-2.5 text-right font-plex-mono text-blue-600">{s.satisfaction_rate}%</td>
                  <td className="py-2.5 text-right font-plex-mono text-slate-500">{s.passengers.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel testid="panel-compare-findings" title="What the Numbers Confirm" className="lg:col-span-2"
          subtitle="High-confidence, statistically validated differences">
          <div className="space-y-3">
            {findings.map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-3 border border-slate-200 rounded-sm">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-slate-900">{f.title}</h4>
                    {f.significant && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-sm">
                        {f.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-plex-mono text-sm text-blue-600">{f.metric}</p>
                  <p className="mt-1 text-xs text-slate-500">{f.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
