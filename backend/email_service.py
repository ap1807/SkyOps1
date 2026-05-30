"""Resend email delivery + branded HTML templates for SkyOps operational emails."""
import os
import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

import resend
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
logger = logging.getLogger("skyops.email")


def is_configured() -> bool:
    return bool(resend.api_key)


async def send_email(to: str, subject: str, html: str) -> dict:
    if not is_configured():
        raise RuntimeError("Email service is not configured (missing RESEND_API_KEY)")
    params = {
        "from": f"SkyOps Ops Intelligence <{SENDER}>",
        "to": [to],
        "subject": subject,
        "html": html,
    }
    return await asyncio.to_thread(resend.Emails.send, params)


# ---------------- templates ----------------
_PRIORITY_COLOR = {"high": "#DC2626", "medium": "#D97706", "low": "#16A34A"}
_LEVEL_COLOR = {"High": "#DC2626", "Elevated": "#D97706", "Low": "#16A34A"}


def _wrap(title: str, preheader: str, body: str) -> str:
    ts = datetime.now(timezone.utc).strftime("%d %b %Y · %H:%M UTC")
    return f"""\
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;opacity:0;color:#F1F5F9;">{preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:6px;overflow:hidden;">
<tr><td style="background:#0F172A;padding:20px 28px;">
<table role="presentation" width="100%"><tr>
<td style="color:#FFFFFF;font-size:18px;font-weight:800;letter-spacing:-0.5px;">SkyOps</td>
<td align="right" style="color:#94A3B8;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Ops Intelligence</td>
</tr></table></td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 4px;font-size:20px;color:#0F172A;">{title}</h1>
<p style="margin:0 0 20px;font-size:12px;color:#94A3B8;">{ts}</p>
{body}
</td></tr>
<tr><td style="padding:18px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;color:#94A3B8;font-size:11px;">
SkyOps Aviation Operations Intelligence · This is an automated operational notification.
</td></tr>
</table></td></tr></table></body></html>"""


def _kpi_grid(k: dict) -> str:
    cells = [
        ("Satisfaction", f"{k.get('satisfaction_rate','—')}%", "#16A34A"),
        ("On-Time", f"{k.get('on_time_performance','—')}%", "#2563EB"),
        ("Operational Risk", f"{k.get('operational_risk_index','—')}/100", "#EA580C"),
        ("Active Flights", f"{k.get('active_flights','—')}", "#0F172A"),
        ("Delayed Now", f"{k.get('delayed_flights','—')}", "#DC2626"),
        ("Avg Congestion", f"{k.get('avg_congestion','—')}%", "#D97706"),
    ]
    tds = ""
    for i, (label, val, color) in enumerate(cells):
        if i % 2 == 0:
            tds += "<tr>"
        tds += (
            f"<td width='50%' style='padding:10px;border:1px solid #EEF2F6;'>"
            f"<div style='font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#94A3B8;'>{label}</div>"
            f"<div style='font-size:24px;font-weight:800;color:{color};margin-top:4px;'>{val}</div></td>"
        )
        if i % 2 == 1:
            tds += "</tr>"
    return f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0' style='border-collapse:collapse;'>{tds}</table>"


def _forecast_box(fc: dict) -> str:
    level = fc.get("level", "—")
    color = _LEVEL_COLOR.get(level, "#475569")
    return (
        f"<table role='presentation' width='100%' style='margin:18px 0;border:1px solid {color}33;background:{color}0D;border-radius:4px;'>"
        f"<tr><td style='padding:14px 16px;'>"
        f"<span style='font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#475569;'>Network Disruption Forecast · {fc.get('window','next 60 min')}</span><br>"
        f"<span style='font-size:28px;font-weight:800;color:#0F172A;'>{fc.get('probability','—')}%</span> "
        f"<span style='font-size:12px;font-weight:700;color:{color};text-transform:uppercase;'>&nbsp;{level} risk</span>"
        f"</td></tr></table>"
    )


def _recs(recs: list) -> str:
    if not recs:
        return ""
    items = ""
    for r in recs:
        color = _PRIORITY_COLOR.get(r.get("priority", "medium"), "#D97706")
        items += (
            f"<tr><td style='padding:10px 0;border-bottom:1px solid #EEF2F6;'>"
            f"<span style='display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;color:#FFF;background:{color};padding:2px 6px;border-radius:3px;'>{r.get('priority','')}</span> "
            f"<span style='font-size:14px;font-weight:600;color:#0F172A;'>{r.get('title','')}</span>"
            f"<div style='font-size:13px;color:#475569;margin-top:3px;'>{r.get('detail','')}</div></td></tr>"
        )
    return (
        "<h3 style='font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#475569;margin:20px 0 6px;'>Smart Recommendations</h3>"
        f"<table role='presentation' width='100%' cellspacing='0' cellpadding='0'>{items}</table>"
    )


def build_briefing_html(name: str, pulse: dict, ai: dict | None = None) -> str:
    k = pulse.get("kpis", {})
    body = f"<p style='font-size:14px;color:#475569;margin:0 0 16px;'>Hello {name}, here is your live operational briefing.</p>"
    if ai and ai.get("summary"):
        body += (
            f"<div style='padding:14px 16px;background:#F8FAFC;border-left:3px solid #2563EB;border-radius:4px;margin-bottom:16px;'>"
            f"<div style='font-size:14px;font-weight:700;color:#0F172A;margin-bottom:4px;'>{ai.get('headline','AI Insight')}</div>"
            f"<div style='font-size:13px;color:#475569;'>{ai.get('summary','')}</div></div>"
        )
    body += _kpi_grid(k)
    body += _forecast_box(pulse.get("disruption_forecast", {}))
    recs = (ai.get("recommendations") if ai else None) or pulse.get("recommendations", [])
    body += _recs(recs)
    return _wrap("Operational Briefing", "Your live SkyOps operational briefing", body)


def build_alert_html(name: str, pulse: dict) -> str:
    fc = pulse.get("disruption_forecast", {})
    level = fc.get("level", "Elevated")
    color = _LEVEL_COLOR.get(level, "#D97706")
    body = (
        f"<table role='presentation' width='100%' style='margin:0 0 18px;background:{color};border-radius:4px;'>"
        f"<tr><td style='padding:16px 18px;color:#FFF;'>"
        f"<div style='font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:0.85;'>Real-time Disruption Alert</div>"
        f"<div style='font-size:22px;font-weight:800;margin-top:4px;'>{level} disruption risk · {fc.get('probability','—')}%</div>"
        f"</td></tr></table>"
        f"<p style='font-size:14px;color:#475569;margin:0 0 14px;'>{name}, network disruption risk has crossed your alert threshold. Current operating snapshot:</p>"
    )
    body += _kpi_grid(pulse.get("kpis", {}))
    body += _recs(pulse.get("recommendations", []))
    return _wrap("Disruption Risk Alert", f"{level} disruption risk detected", body)


def build_digest_html(name: str, pulse: dict) -> str:
    body = f"<p style='font-size:14px;color:#475569;margin:0 0 16px;'>Good day {name}, here is your daily operations digest.</p>"
    body += _kpi_grid(pulse.get("kpis", {}))
    body += _forecast_box(pulse.get("disruption_forecast", {}))
    body += _recs(pulse.get("recommendations", []))
    return _wrap("Daily Operations Digest", "Your SkyOps daily operations digest", body)
