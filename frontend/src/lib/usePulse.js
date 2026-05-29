import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";

// Polls the backend-driven realtime pulse so every dashboard reflects
// continuously updating, server-side operational state.
export default function usePulse(intervalMs = 3000, enabled = true) {
  const [pulse, setPulse] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const poll = useCallback(async () => {
    try {
      const res = await api.get("/realtime/pulse");
      setPulse(res.data);
      setUpdatedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    poll();
    timer.current = setInterval(poll, intervalMs);
    return () => clearInterval(timer.current);
  }, [poll, intervalMs, enabled]);

  return { pulse, error, updatedAt, refresh: poll };
}
