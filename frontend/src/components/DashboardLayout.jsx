import { useState, useEffect } from "react";
import { NavLink, useNavigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Gauge, Sparkles, GitCompareArrows, AlertTriangle,
  Bot, Database, Plane, LogOut, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Executive Overview", icon: LayoutDashboard, end: true },
  { to: "/satisfaction", label: "Satisfaction Analytics", icon: Gauge },
  { to: "/predict", label: "Predictive Insights", icon: Sparkles },
  { to: "/compare", label: "Segment Comparisons", icon: GitCompareArrows },
  { to: "/disruptions", label: "Disruption Monitor", icon: AlertTriangle },
  { to: "/advisor", label: "AI Advisor", icon: Bot },
  { to: "/explorer", label: "Data Explorer", icon: Database },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-plex-mono text-xs text-slate-500 tabular-nums" data-testid="header-clock">
      {now.toUTCString().slice(17, 25)} UTC
    </span>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const current = NAV.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-slate-200">
          <div className="w-9 h-9 bg-slate-900 rounded-sm flex items-center justify-center">
            <Plane className="w-5 h-5 text-white -rotate-45" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-black text-slate-900 tracking-tight">SkyOps</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Ops Intelligence</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`nav-${item.to === "/" ? "overview" : item.to.slice(1)}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-200">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">System Status</div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-emerald-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 live-dot" /> All systems operational
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 pl-64 flex flex-col min-w-0">
        <header className="h-16 sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between px-8">
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight text-slate-900" data-testid="page-title">
              {current?.label || "SkyOps"}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <Clock />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="user-menu-button"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-slate-100 transition-colors"
                >
                  <span className="w-8 h-8 bg-blue-600 text-white rounded-sm flex items-center justify-center text-xs font-bold">
                    {initials}
                  </span>
                  <span className="text-sm font-medium text-slate-700 max-w-[140px] truncate">
                    {user?.name || user?.email}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-xs text-slate-400 font-normal">Signed in as</div>
                  <div className="truncate">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="logout-button" onClick={handleLogout} className="text-rose-600 focus:text-rose-700">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-8" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
