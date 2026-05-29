import io
import logging
import os
import asyncio

import pandas as pd
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI, APIRouter, Depends, UploadFile, File, HTTPException
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from database import db, close_client
from auth import auth_router, get_current_user, seed_admin
from data_engine import engine, SERVICE_FIELDS, SERVICE_LABELS, CLASSES
from feed_engine import feed
from realtime_engine import realtime
from ai_insights import generate_insights

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("skyops")

app = FastAPI(title="SkyOps Aviation Intelligence")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"service": "SkyOps Aviation Intelligence", "status": "online"}


@api.get("/meta")
async def meta(user: dict = Depends(get_current_user)):
    return {
        "service_fields": [{"field": f, "label": SERVICE_LABELS[f]} for f in SERVICE_FIELDS],
        "classes": CLASSES,
    }


# ---------------- analytics ----------------
@api.get("/analytics/overview")
async def overview(user: dict = Depends(get_current_user)):
    return engine.overview_metrics()


@api.get("/analytics/satisfaction")
async def satisfaction(user: dict = Depends(get_current_user)):
    return engine.satisfaction_breakdown()


@api.get("/analytics/age-distribution")
async def age_dist(user: dict = Depends(get_current_user)):
    return {"bands": engine.age_distribution()}


@api.get("/analytics/drivers")
async def drivers(user: dict = Depends(get_current_user)):
    return {"drivers": engine.satisfaction_drivers()}


@api.get("/analytics/conditional")
async def conditional(user: dict = Depends(get_current_user)):
    return {"insights": engine.conditional_insights()}


@api.get("/analytics/significance")
async def significance(user: dict = Depends(get_current_user)):
    return {"findings": engine.significance_findings()}


@api.get("/analytics/compare")
async def compare(dimension: str = "class", user: dict = Depends(get_current_user)):
    return engine.compare_segments(dimension)


@api.get("/analytics/explorer")
async def explorer(limit: int = 50, travel_class: Optional[str] = None,
                   satisfied: Optional[int] = None, user: dict = Depends(get_current_user)):
    return {"rows": engine.sample_rows(limit=min(limit, 200), travel_class=travel_class, satisfied=satisfied),
            "source": engine.source}


class PredictBody(BaseModel):
    travel_class: Optional[str] = "Eco"
    customer_type: Optional[str] = "Loyal"
    travel_type: Optional[str] = "Business"
    age: Optional[int] = None
    flight_distance: Optional[int] = None
    arrival_delay: Optional[int] = None
    seat_comfort: Optional[int] = None
    online_boarding: Optional[int] = None
    inflight_wifi: Optional[int] = None
    inflight_entertainment: Optional[int] = None
    onboard_service: Optional[int] = None
    legroom_service: Optional[int] = None
    cleanliness: Optional[int] = None


@api.post("/analytics/predict")
async def predict(body: PredictBody, user: dict = Depends(get_current_user)):
    return engine.predict(body.model_dump())


@api.post("/analytics/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    try:
        raw = await file.read()
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}")

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    rename = {
        "inflight_wifi_service": "inflight_wifi",
        "ease_of_online_booking": "online_booking",
        "food_and_drink": "food_and_drink",
        "leg_room_service": "legroom_service",
        "departure/arrival_time_convenient": "time_convenience",
        "class": "travel_class",
        "type_of_travel": "travel_type",
        "arrival_delay_in_minutes": "arrival_delay",
        "departure_delay_in_minutes": "departure_delay",
    }
    df = df.rename(columns=rename)
    sat_col = next((c for c in ["satisfied", "satisfaction"] if c in df.columns), None)
    if not sat_col:
        raise HTTPException(status_code=400, detail="CSV must include a 'satisfaction' or 'satisfied' column")
    if sat_col == "satisfaction":
        # exact-match labels: 'satisfied' -> 1, anything else (e.g. 'neutral or dissatisfied') -> 0
        df["satisfied"] = df["satisfaction"].astype(str).str.strip().str.lower().eq("satisfied").astype(int)
    else:
        df["satisfied"] = pd.to_numeric(df["satisfied"], errors="coerce")
    missing = [f for f in SERVICE_FIELDS if f not in df.columns]
    for f in missing:
        df[f] = 3
    for c in ["age", "flight_distance", "arrival_delay", "departure_delay"]:
        if c not in df.columns:
            df[c] = 0
    for c in ["customer_type", "travel_type", "travel_class", "gender"]:
        if c not in df.columns:
            df[c] = "Eco" if c == "travel_class" else "Unknown"
    df = df.dropna(subset=["satisfied"])
    df["satisfied"] = df["satisfied"].astype(int)
    if len(df) < 30:
        raise HTTPException(status_code=400, detail="Dataset too small after cleaning (need >= 30 rows)")
    if df["satisfied"].nunique() < 2:
        raise HTTPException(status_code=400, detail="Dataset must contain both satisfied and dissatisfied passengers")
    try:
        engine.load_dataframe(df, f"Uploaded: {file.filename}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "rows": int(len(df)), "source": engine.source}


# ---------------- live feed ----------------
@api.get("/feed/live")
async def live(user: dict = Depends(get_current_user)):
    return feed.view()


@api.get("/realtime/pulse")
async def pulse(user: dict = Depends(get_current_user)):
    return realtime.pulse()


# ---------------- AI ----------------
class InsightBody(BaseModel):
    scope: str = "overview"


@api.post("/ai/insights")
async def ai_insights(body: InsightBody, user: dict = Depends(get_current_user)):
    if body.scope == "disruption":
        p = realtime.pulse()
        context = {**p["kpis"], "disruption_forecast": p["disruption_forecast"]}
    elif body.scope == "satisfaction":
        context = {
            "overview": engine.overview_metrics(),
            "drivers": engine.satisfaction_drivers()[:5],
        }
    else:
        context = {
            "overview": engine.overview_metrics(),
            "live": realtime.pulse()["kpis"],
        }
    result = await generate_insights(body.scope, context)
    return result


app.include_router(auth_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_start():
    await seed_admin()
    try:
        await db.users.create_index("email", unique=True)
        await db.login_attempts.create_index("identifier")
    except Exception as e:
        logger.warning(f"index setup: {e}")
    app.state.rt_task = asyncio.create_task(_realtime_loop())
    logger.info("SkyOps backend ready.")


async def _realtime_loop():
    """Server-side ticker: evolves live operational state every few seconds."""
    while True:
        await asyncio.sleep(3)
        try:
            realtime.tick()
        except Exception as e:
            logger.warning(f"realtime tick error: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    task = getattr(app.state, "rt_task", None)
    if task:
        task.cancel()
    close_client()
