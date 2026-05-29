# SkyOps — Aviation Operations Intelligence Platform

## Original Problem Statement
Production-grade real-time aviation passenger satisfaction analytics platform using Probability & Statistics concepts (descriptive stats, probability, conditional probability, hypothesis testing) surfaced to users as intelligent analytics, AI insights, real-time monitoring, comparisons and smart recommendations. Light-theme enterprise UI.

## User Choices
- Dataset: self-contained synthetic (Airline Passenger Satisfaction schema) + CSV upload
- AI: Emergent LLM key (model: openai gpt-4o)
- Real-time: server-side simulated live operational feed
- Auth: JWT email/password login
- Style: modern minimal light-theme enterprise (Swiss/high-contrast; Chivo + IBM Plex Sans)

## Architecture
- Backend: FastAPI (/api prefix), MongoDB (users/auth + brute-force), in-memory pandas dataset (9000 rows).
  - auth.py (JWT bcrypt), data_engine.py (AnalyticsEngine: descriptive/probability/conditional/hypothesis testing + sklearn LogisticRegression prediction), feed_engine.py (simulated live feed), ai_insights.py (emergentintegrations LlmChat).
- Frontend: React + react-router + recharts + sonner + shadcn UI. AuthContext (localStorage Bearer), ProtectedRoute, DashboardLayout (sidebar + header dropdown).

## Implemented (2026-05-29)
- JWT auth: register/login/me/logout, admin seed (admin@skyops.ai / SkyOps@2026)
- Executive Overview: live KPIs, satisfaction-by-class, live operational risk trend, live feed
- Satisfaction Analytics: drivers (correlation), conditional insights, age bands, split donut, statistical findings (z-test/t-test/chi-square shown as "confidence")
- Predictive Insights: profile sliders/selects -> satisfaction probability gauge + influencing factors
- Segment Comparisons: dimension selector -> dual-axis chart + table + validated findings
- Disruption Monitor: risk gauges, airport congestion, live disruption stream, flight board
- AI Advisor: scope-based gpt-4o natural-language insights + prioritized recommendations
- Data Explorer: filters + records table + CSV upload (transactional, validated)

## Status
- Backend tested 27/28 -> CSV upload critical bugs fixed (label mapping + atomic load_dataframe). Frontend 100% across 7 routes. AI insights confirmed real gpt-4o.

## Realtime Upgrade (2026-05-29)
- Added backend-driven realtime layer: realtime_engine.py with a server-side asyncio ticker (every 3s) that advances the live feed, drifts live satisfaction (engine.live_delta), recomputes a network disruption forecast and rule-based smart recommendations.
- New endpoint GET /api/realtime/pulse (kpis, server-maintained history, by_class, events, congestion, flights, disruption_forecast, recommendations).
- feed_engine split into tick() (advance) + view() (read-only); analytics now reflect live drift.
- Frontend usePulse hook (3s polling): Overview, Disruption, Predictive, Advisor stream live; Satisfaction & Comparisons auto-refresh. Live trend chart streams satisfaction vs risk.
- Tested 33/33 backend. Hardened /analytics/drivers & /analytics/significance to be NaN/degenerate-safe (no 500 on sparse uploads); frontend fetches wrapped in catch.

## Backlog / Next
- P1: WebSocket push for feed (currently 3-4s polling); persist datasets per user
- P1: Route-level deep dives, downloadable PDF executive briefings
- P2: Forgot/reset password flow; cookie secure=True in production; remove demo-prefilled password
- P2: Honor CORS_ORIGINS env consistently
