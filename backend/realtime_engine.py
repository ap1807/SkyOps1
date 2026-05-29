"""
Backend-driven realtime engine.

Ticks server-side on a background loop (independent of any client). On each tick it
advances the live operational feed, drifts the live satisfaction signal, recomputes a
network disruption forecast and regenerates rule-based smart recommendations that react
to current conditions. Clients poll /api/realtime/pulse to receive continuously updating
state instead of static values.
"""
import math
import random
from collections import deque
from datetime import datetime, timezone

from data_engine import engine
from feed_engine import feed, AIRPORTS

_CITY = dict(AIRPORTS)


class RealtimeEngine:
    def __init__(self):
        self.history = deque(maxlen=40)
        self.forecast = {}
        self.recommendations = []
        self.tick()

    def tick(self):
        feed.tick()
        # random-walk the live satisfaction drift (bounded)
        engine.live_delta = max(-4.0, min(4.0, engine.live_delta + random.uniform(-0.7, 0.7)))

        fk = feed.view()["kpis"]
        ov = engine.overview_metrics()
        self.history.append({
            "t": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "risk": fk["operational_risk"],
            "satisfaction": ov["satisfaction_rate"],
            "on_time": fk["on_time_pct"],
        })
        self._forecast(fk)
        self._recommend(fk)

    def _forecast(self, fk):
        risk = fk["operational_risk"]
        p = 1 / (1 + math.exp(-(risk - 48) / 10))
        level = "High" if p >= 0.6 else "Elevated" if p >= 0.4 else "Low"
        self.forecast = {
            "probability": round(p * 100, 1),
            "level": level,
            "window": "next 60 min",
        }

    def _recommend(self, fk):
        recs = []
        active = max(1, fk["active_flights"])
        delay_ratio = fk["delayed_flights"] / active
        if delay_ratio > 0.25:
            recs.append({
                "title": "Activate delay recovery",
                "detail": f"{fk['delayed_flights']} of {active} active flights delayed — prioritise turnaround, crew reallocation and passenger rebooking.",
                "priority": "high",
            })
        cong = feed.view()["congestion"]
        if cong and cong[0]["index"] >= 60:
            top = cong[0]
            recs.append({
                "title": f"Decongest {top['airport']} ({top['city']})",
                "detail": f"Congestion index at {top['index']} — stagger departures and open additional ground handling lanes.",
                "priority": "high" if top["index"] >= 75 else "medium",
            })
        if fk["weather_risk"] >= 40:
            recs.append({
                "title": "Weather buffering",
                "detail": f"Weather exposure at {fk['weather_risk']}% of the fleet — add schedule buffers and pre-position recovery aircraft.",
                "priority": "medium",
            })
        if engine.live_delta < -1.0:
            recs.append({
                "title": "Reinforce cabin service",
                "detail": "Live satisfaction is trending down — deploy service-recovery measures on economy segments and high-load flights.",
                "priority": "medium",
            })
        if len(recs) < 3:
            recs.append({
                "title": "Sustain steady-state operations",
                "detail": "Network conditions are stable — maintain proactive monitoring and capitalise on the low-risk window.",
                "priority": "low",
            })
        self.recommendations = recs[:4]

    def pulse(self):
        fv = feed.view()
        fk = fv["kpis"]
        ov = engine.overview_metrics()
        sb = engine.satisfaction_breakdown()
        return {
            "timestamp": fv["timestamp"],
            "kpis": {
                "satisfaction_rate": ov["satisfaction_rate"],
                "on_time_performance": fk["on_time_pct"],
                "operational_risk_index": fk["operational_risk"],
                "avg_service_rating": ov["avg_service_rating"],
                "active_flights": fk["active_flights"],
                "delayed_flights": fk["delayed_flights"],
                "avg_congestion": fk["avg_congestion"],
                "weather_risk": fk["weather_risk"],
                "loyal_share": ov["loyal_share"],
                "business_share": ov["business_share"],
                "total_passengers": ov["total_passengers"],
            },
            "history": list(self.history),
            "by_class": sb["by_class"],
            "events": fv["events"],
            "congestion": fv["congestion"],
            "flights": fv["flights"],
            "disruption_forecast": self.forecast,
            "recommendations": self.recommendations,
            "source": ov["source"],
        }


realtime = RealtimeEngine()
