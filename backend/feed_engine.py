"""
Server-side simulated live operational feed: flights, delays, airport congestion,
weather disruptions and rolling operational risk. Each poll advances the simulation
with small smooth drifts so the dashboard feels alive.
"""
import random
from datetime import datetime, timezone

AIRPORTS = [
    ("JFK", "New York"), ("LHR", "London"), ("DXB", "Dubai"), ("SIN", "Singapore"),
    ("LAX", "Los Angeles"), ("HND", "Tokyo"), ("CDG", "Paris"), ("FRA", "Frankfurt"),
    ("DEL", "Delhi"), ("SFO", "San Francisco"), ("AMS", "Amsterdam"), ("ORD", "Chicago"),
]
AIRLINES = ["Skyline", "AeroLux", "NorthJet", "Pacific", "Meridian", "Altitude"]
WEATHER = ["Clear", "Clear", "Light Rain", "Fog", "Thunderstorm", "Snow", "Windy"]
STATUSES = ["On Time", "On Time", "On Time", "Boarding", "Delayed", "Departed"]

EVENT_TEMPLATES = [
    ("delay", "Flight {fl} to {dest} delayed {min} min — {reason}"),
    ("weather", "{reason} advisory issued at {ap} ({apc})"),
    ("congestion", "Congestion building at {ap} — {n} aircraft holding"),
    ("recovery", "Flight {fl} recovered schedule after {min} min hold"),
    ("satisfaction", "Cabin service score dipped on route {fl} → {dest}"),
]
REASONS = ["weather", "air traffic control", "late inbound aircraft", "crew rotation", "runway congestion"]


def _flight_no():
    return random.choice(AIRLINES)[:2].upper() + str(random.randint(100, 9990))


class FeedState:
    def __init__(self):
        self.flights = [self._new_flight() for _ in range(14)]
        self.congestion = {ap[0]: random.uniform(0.3, 0.7) for ap in AIRPORTS}
        self.events = []
        self._seed_events()

    def _new_flight(self):
        origin, dest = random.sample(AIRPORTS, 2)
        delay = max(0, int(random.expovariate(1 / 18) - 8))
        status = "Delayed" if delay > 15 else random.choice(STATUSES)
        return {
            "flight": _flight_no(),
            "airline": random.choice(AIRLINES),
            "origin": origin[0],
            "origin_city": origin[1],
            "dest": dest[0],
            "dest_city": dest[1],
            "delay": delay,
            "status": status,
            "weather": random.choice(WEATHER),
            "load_factor": round(random.uniform(0.62, 0.99), 2),
        }

    def _seed_events(self):
        for _ in range(8):
            self._emit_event()

    def _emit_event(self):
        kind, tmpl = random.choice(EVENT_TEMPLATES)
        f = random.choice(self.flights)
        ap = random.choice(AIRPORTS)
        msg = tmpl.format(
            fl=f["flight"], dest=f["dest_city"], min=random.randint(10, 95),
            reason=random.choice(REASONS).title(), ap=ap[0], apc=ap[1],
            n=random.randint(3, 12),
        )
        self.events.insert(0, {
            "id": f"{datetime.now(timezone.utc).timestamp()}-{random.randint(0,9999)}",
            "kind": kind,
            "message": msg,
            "time": datetime.now(timezone.utc).strftime("%H:%M:%S"),
        })
        self.events = self.events[:30]

    def tick(self):
        # drift congestion
        for k in self.congestion:
            self.congestion[k] = min(0.98, max(0.15, self.congestion[k] + random.uniform(-0.08, 0.08)))
        # update some flights
        for f in random.sample(self.flights, k=min(5, len(self.flights))):
            f["delay"] = max(0, f["delay"] + random.randint(-8, 14))
            f["status"] = "Delayed" if f["delay"] > 15 else random.choice(STATUSES)
        # occasionally cycle a flight
        if random.random() < 0.5:
            self.flights.pop()
            self.flights.insert(0, self._new_flight())
        # new events
        for _ in range(random.randint(1, 2)):
            self._emit_event()

    def view(self):
        active = len(self.flights)
        delayed = sum(1 for f in self.flights if f["delay"] > 15)
        on_time_pct = round((1 - delayed / active) * 100, 1) if active else 100.0
        avg_cong = sum(self.congestion.values()) / len(self.congestion)
        weather_risk = round(
            sum(1 for f in self.flights if f["weather"] in ("Thunderstorm", "Snow", "Fog")) / active * 100, 1
        ) if active else 0.0
        op_risk = round(min(100, 0.4 * (delayed / active * 100) + 0.35 * (avg_cong * 100) + 0.25 * weather_risk), 1) if active else 0.0

        congestion_list = sorted(
            [{"airport": k, "city": dict(AIRPORTS)[k], "index": round(v * 100, 1)}
             for k, v in self.congestion.items()],
            key=lambda x: x["index"], reverse=True,
        )
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "kpis": {
                "active_flights": active,
                "on_time_pct": on_time_pct,
                "delayed_flights": delayed,
                "avg_congestion": round(avg_cong * 100, 1),
                "weather_risk": weather_risk,
                "operational_risk": op_risk,
            },
            "flights": self.flights,
            "events": self.events[:14],
            "congestion": congestion_list,
        }

    def snapshot(self):
        # advance state then return current view (used by request-driven callers)
        self.tick()
        return self.view()


feed = FeedState()
