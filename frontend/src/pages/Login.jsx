import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Plane, ArrowRight, ShieldCheck, Activity, Brain } from "lucide-react";
import { toast } from "sonner";

const BG = "https://static.prod-images.emergentagent.com/jobs/1525d765-1c9c-4bcb-bfe0-5f82cec57d49/images/838db9bf60df7ed45746ad762cb9652a3fea267fc6b0509a9503b09d1cccbf0c.png";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("admin@skyops.ai");
  const [password, setPassword] = useState("SkyOps@2026");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res =
      mode === "login"
        ? await login(email, password)
        : await register(email, password, name);
    setLoading(false);
    if (res.ok) {
      toast.success(mode === "login" ? "Welcome back" : "Account created");
      navigate("/");
    } else {
      toast.error(res.error || "Authentication failed");
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left: form */}
      <div className="w-full lg:w-[46%] flex flex-col justify-center px-8 sm:px-16 xl:px-24">
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-9 h-9 bg-slate-900 rounded-sm flex items-center justify-center">
            <Plane className="w-5 h-5 text-white -rotate-45" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-black text-slate-900 tracking-tight text-lg">SkyOps</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Aviation Operations Intelligence</div>
          </div>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-none">
          {mode === "login" ? "Operations" : "Create your"}
          <br />
          {mode === "login" ? "Command Center" : "operations access"}
        </h1>
        <p className="mt-4 text-sm text-slate-500 max-w-md leading-relaxed">
          Real-time passenger satisfaction intelligence, predictive risk monitoring and AI-powered
          operational recommendations — in one control room.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-4 max-w-md" data-testid="auth-form">
          {mode === "register" && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Full name</label>
              <input
                data-testid="name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Carter"
                className="mt-1.5 w-full border border-slate-300 rounded-sm px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Work email</label>
            <input
              data-testid="email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@airline.com"
              className="mt-1.5 w-full border border-slate-300 rounded-sm px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Password</label>
            <input
              data-testid="password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full border border-slate-300 rounded-sm px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            data-testid="submit-button"
            type="submit"
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm py-3 rounded-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99]"
          >
            {loading ? "Authenticating…" : mode === "login" ? "Enter Command Center" : "Create account"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <button
          data-testid="toggle-mode"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-6 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          {mode === "login" ? "New analyst? Create an account" : "Already have access? Sign in"}
        </button>

        <div className="mt-10 text-xs text-slate-400">
          Demo access · <span className="font-plex-mono">admin@skyops.ai / SkyOps@2026</span>
        </div>
      </div>

      {/* Right: visual */}
      <div className="hidden lg:block lg:w-[54%] relative bg-slate-900">
        <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/80 via-slate-900/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <div className="grid grid-cols-3 gap-4 max-w-xl">
            {[
              { icon: Activity, t: "Live Ops Feed", d: "Real-time disruption monitoring" },
              { icon: Brain, t: "AI Predictions", d: "Satisfaction & risk forecasting" },
              { icon: ShieldCheck, t: "Risk Intelligence", d: "Congestion & weather signals" },
            ].map((f) => (
              <div key={f.t} className="bg-white/10 backdrop-blur border border-white/15 rounded-sm p-4">
                <f.icon className="w-5 h-5 text-white/90" />
                <div className="mt-3 text-sm font-semibold text-white">{f.t}</div>
                <div className="text-xs text-white/60 mt-1">{f.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
