import { useState } from "react";
import api from "@/lib/api";
import { Panel, PriorityBadge } from "@/components/widgets";
import { Bot, Sparkles, AlertTriangle, Cpu } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const SCOPES = [
  { value: "overview", label: "Network Overview" },
  { value: "satisfaction", label: "Passenger Satisfaction" },
  { value: "disruption", label: "Live Disruptions" },
];

export default function Advisor() {
  const [scope, setScope] = useState("overview");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post("/ai/insights", { scope });
      setResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Panel testid="panel-advisor-controls" title="SkyOps AI Advisor"
        subtitle="Generate executive operational guidance">
        <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-sm">
          <div className="w-10 h-10 bg-white/10 rounded-sm flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">AI Operations Strategist</div>
            <div className="text-xs text-white/50">Reads live signals & statistical intelligence</div>
          </div>
        </div>

        <label className="block mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 mb-1.5">Focus Area</label>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger data-testid="select-scope" className="rounded-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SCOPES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button onClick={generate} disabled={loading} data-testid="generate-insights"
          className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]">
          <Sparkles className="w-4 h-4" /> {loading ? "Thinking…" : "Generate Insights"}
        </button>

        {result?.generated_by && (
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Cpu className="w-3.5 h-3.5" /> Powered by <span className="font-plex-mono">{result.generated_by}</span>
          </div>
        )}
      </Panel>

      <div className="lg:col-span-2 space-y-6">
        {loading && (
          <Panel testid="advisor-loading">
            <div className="py-16 flex flex-col items-center text-slate-400">
              <Bot className="w-8 h-8 animate-pulse" />
              <p className="mt-3 text-sm">Analysing operational signals…</p>
            </div>
          </Panel>
        )}

        {result && !loading && (
          <>
            <Panel testid="advisor-summary" title={result.headline || "Operational Insight"}>
              <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
              {result.risk_callout && (
                <div className="mt-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">{result.risk_callout}</p>
                </div>
              )}
            </Panel>

            <Panel testid="advisor-recommendations" title="Smart Recommendations"
              subtitle="Prioritised actions for the operations team">
              <div className="space-y-3">
                {(result.recommendations || []).map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 border border-slate-200 rounded-sm hover:border-slate-300 transition-colors">
                    <span className="font-display font-black text-slate-200 text-xl leading-none">{String(i + 1).padStart(2, "0")}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-slate-900">{r.title}</h4>
                        <PriorityBadge level={r.priority} />
                      </div>
                      <p className="mt-1 text-sm text-slate-500 leading-relaxed">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}

        {!result && !loading && (
          <Panel testid="advisor-empty">
            <div className="py-16 flex flex-col items-center text-slate-300">
              <Bot className="w-10 h-10" />
              <p className="mt-3 text-sm text-slate-400">Select a focus area and generate AI-powered insights.</p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
