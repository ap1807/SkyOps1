import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Panel } from "@/components/widgets";
import { Sparkles, Plane, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const RATINGS = [
  ["seat_comfort", "Seat Comfort"],
  ["online_boarding", "Online Boarding"],
  ["inflight_wifi", "Inflight Wifi"],
  ["inflight_entertainment", "Inflight Entertainment"],
  ["onboard_service", "Onboard Service"],
  ["legroom_service", "Legroom"],
  ["cleanliness", "Cleanliness"],
];

export default function Predictive() {
  const [form, setForm] = useState({
    travel_class: "Eco",
    customer_type: "Loyal",
    travel_type: "Business",
    arrival_delay: 20,
    seat_comfort: 3,
    online_boarding: 3,
    inflight_wifi: 3,
    inflight_entertainment: 3,
    onboard_service: 3,
    legroom_service: 3,
    cleanliness: 3,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true);
    try {
      const res = await api.post("/analytics/predict", form);
      setResult(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prob = result?.satisfaction_probability ?? 0;
  const good = prob >= 50;
  const color = prob >= 70 ? "#16A34A" : prob >= 45 ? "#D97706" : "#DC2626";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Config */}
      <Panel testid="panel-predict-config" className="lg:col-span-3" title="Passenger & Journey Profile"
        subtitle="Model the experience to forecast satisfaction">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Cabin Class">
            <Select value={form.travel_class} onValueChange={(v) => set("travel_class", v)}>
              <SelectTrigger data-testid="select-class" className="rounded-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Eco Plus">Eco Plus</SelectItem>
                <SelectItem value="Eco">Economy</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Customer Type">
            <Select value={form.customer_type} onValueChange={(v) => set("customer_type", v)}>
              <SelectTrigger data-testid="select-customer" className="rounded-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Loyal">Loyal</SelectItem>
                <SelectItem value="Disloyal">First-time</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Travel Purpose">
            <Select value={form.travel_type} onValueChange={(v) => set("travel_type", v)}>
              <SelectTrigger data-testid="select-travel" className="rounded-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Arrival Delay</label>
            <span className="font-plex-mono text-sm text-slate-900">{form.arrival_delay} min</span>
          </div>
          <Slider value={[form.arrival_delay]} min={0} max={240} step={5}
            onValueChange={([v]) => set("arrival_delay", v)} data-testid="slider-delay" />
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          {RATINGS.map(([key, label]) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-600">{label}</label>
                <span className="font-plex-mono text-sm text-blue-600">{form[key]}/5</span>
              </div>
              <Slider value={[form[key]]} min={0} max={5} step={1}
                onValueChange={([v]) => set(key, v)} data-testid={`slider-${key}`} />
            </div>
          ))}
        </div>

        <button onClick={run} disabled={loading} data-testid="run-prediction"
          className="mt-7 w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm py-3 rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]">
          <Sparkles className="w-4 h-4" /> {loading ? "Analysing…" : "Run Prediction"}
        </button>
      </Panel>

      {/* Result */}
      <div className="lg:col-span-2 space-y-6">
        <Panel testid="panel-predict-result" title="Satisfaction Forecast">
          <div className="flex flex-col items-center py-2">
            <div className="relative w-40 h-40 rounded-full"
              style={{ background: `conic-gradient(${color} ${prob * 3.6}deg, #EEF2F6 0deg)` }}>
              <div className="absolute inset-3 bg-white rounded-full flex flex-col items-center justify-center">
                <span className="font-display text-4xl font-black" style={{ color }}>{prob}%</span>
                <span className="text-[10px] uppercase tracking-widest text-slate-400">likely satisfied</span>
              </div>
            </div>
            <div className={`mt-4 flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-semibold ${good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
              data-testid="prediction-label">
              <Plane className="w-4 h-4" /> {result?.prediction || "—"}
            </div>
            <p className="mt-2 text-xs text-slate-400">Confidence {result?.confidence ?? "—"}%</p>
          </div>
        </Panel>

        <Panel testid="panel-predict-drivers" title="Key Influencing Factors">
          <div className="space-y-2.5">
            {(result?.drivers || []).map((d, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-sm">
                <span className="text-sm text-slate-700">{d.factor}</span>
                <span className={`flex items-center gap-1 text-xs font-semibold ${d.direction === "positive" ? "text-emerald-600" : "text-rose-600"}`}>
                  {d.direction === "positive" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {d.direction}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
