import { useEffect, useRef, useState, useCallback } from "react";
import api from "@/lib/api";

export default function useLiveFeed(intervalMs = 4000, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  const poll = useCallback(async () => {
    try {
      const res = await api.get("/feed/live");
      setData(res.data);
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

  return { data, error, refresh: poll };
}
