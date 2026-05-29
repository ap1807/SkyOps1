import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Plane } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" data-testid="auth-loading">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Plane className="w-7 h-7 animate-pulse" />
          <span className="text-xs uppercase tracking-[0.2em]">Loading SkyOps</span>
        </div>
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  return children;
}
