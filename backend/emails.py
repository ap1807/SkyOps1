"""Email preferences, on-demand briefing, and alert/digest dispatch."""
import logging
from datetime import datetime, timezone, timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from database import db
from auth import get_current_user
from realtime_engine import realtime
import email_service as mail

logger = logging.getLogger("skyops.email")
email_router = APIRouter(prefix="/api/email", tags=["email"])

LEVEL_RANK = {"Low": 0, "Elevated": 1, "High": 2}
ALERT_COOLDOWN = timedelta(minutes=30)
_alert_cooldown: dict[str, datetime] = {}
_last_digest_date = {"date": None}


class SettingsBody(BaseModel):
    alerts_enabled: bool
    alert_threshold: str = "High"  # "Elevated" | "High"
    daily_digest: bool = False


def _settings_of(user_doc: dict) -> dict:
    ea = user_doc.get("email_alerts", {}) or {}
    return {
        "email": user_doc["email"],
        "alerts_enabled": bool(ea.get("enabled", False)),
        "alert_threshold": ea.get("threshold", "High"),
        "daily_digest": bool(user_doc.get("daily_digest", False)),
        "email_configured": mail.is_configured(),
    }


@email_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    return _settings_of(doc)


@email_router.put("/settings")
async def update_settings(body: SettingsBody, user: dict = Depends(get_current_user)):
    threshold = body.alert_threshold if body.alert_threshold in ("Elevated", "High") else "High"
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {
            "email_alerts": {"enabled": body.alerts_enabled, "threshold": threshold},
            "daily_digest": body.daily_digest,
        }},
    )
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    return _settings_of(doc)


class BriefingBody(BaseModel):
    include_ai: Optional[bool] = True


@email_router.post("/briefing")
async def send_briefing(body: BriefingBody, user: dict = Depends(get_current_user)):
    if not mail.is_configured():
        raise HTTPException(status_code=503, detail="Email service is not configured")
    pulse = realtime.pulse()
    ai = None
    if body.include_ai:
        try:
            from ai_insights import generate_insights
            ai = await generate_insights("overview", {"overview": pulse["kpis"], "live": pulse["kpis"]})
        except Exception as e:
            logger.warning(f"briefing AI skipped: {e}")
    html = mail.build_briefing_html(user.get("name") or user["email"], pulse, ai)
    try:
        res = await mail.send_email(user["email"], "SkyOps · Operational Briefing", html)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {e}")
    return {"status": "sent", "to": user["email"], "id": (res or {}).get("id")}


@email_router.post("/test")
async def send_test(user: dict = Depends(get_current_user)):
    if not mail.is_configured():
        raise HTTPException(status_code=503, detail="Email service is not configured")
    html = mail.build_briefing_html(user.get("name") or user["email"], realtime.pulse(), None)
    try:
        res = await mail.send_email(user["email"], "SkyOps · Test Email", html)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Email delivery failed: {e}")
    return {"status": "sent", "to": user["email"], "id": (res or {}).get("id")}


# ---------------- background dispatch ----------------
async def dispatch_disruption_alerts():
    """Called from the realtime loop. Emails opted-in users when risk crosses threshold."""
    if not mail.is_configured():
        return
    level = realtime.forecast.get("level", "Low")
    cur = LEVEL_RANK.get(level, 0)
    if cur < 1:
        return
    users = await db.users.find({"email_alerts.enabled": True}).to_list(200)
    if not users:
        return
    pulse = realtime.pulse()
    now = datetime.now(timezone.utc)
    for u in users:
        thr = LEVEL_RANK.get((u.get("email_alerts") or {}).get("threshold", "High"), 2)
        if cur < thr:
            continue
        uid = str(u["_id"])
        last = _alert_cooldown.get(uid)
        if last and now - last < ALERT_COOLDOWN:
            continue
        _alert_cooldown[uid] = now
        try:
            html = mail.build_alert_html(u.get("name") or u["email"], pulse)
            await mail.send_email(u["email"], f"SkyOps Alert · {level} disruption risk", html)
            logger.info(f"alert email sent to {u['email']} ({level})")
        except Exception as e:
            logger.warning(f"alert email failed for {u.get('email')}: {e}")


async def dispatch_daily_digest():
    """Called periodically; sends a digest once per UTC day (after 08:00) to opted-in users."""
    if not mail.is_configured():
        return
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    if now.hour < 8 or _last_digest_date["date"] == today:
        return
    users = await db.users.find({"daily_digest": True}).to_list(200)
    _last_digest_date["date"] = today
    if not users:
        return
    pulse = realtime.pulse()
    for u in users:
        try:
            html = mail.build_digest_html(u.get("name") or u["email"], pulse)
            await mail.send_email(u["email"], "SkyOps · Daily Operations Digest", html)
            logger.info(f"digest email sent to {u['email']}")
        except Exception as e:
            logger.warning(f"digest email failed for {u.get('email')}: {e}")
