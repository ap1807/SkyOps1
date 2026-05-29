"""SkyOps backend regression tests.

Covers auth (JWT login/register/me/logout), analytics endpoints, CSV upload,
live feed, and AI insights. All requests go through REACT_APP_BACKEND_URL.
"""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@skyops.ai"
ADMIN_PASSWORD = "SkyOps@2026"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(session):
    r = session.post(f"{API}/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and data["access_token"]
    assert data["user"]["email"] == ADMIN_EMAIL
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- auth ----------
class TestAuth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200

    def test_login_admin(self, session):
        r = session.post(f"{API}/auth/login",
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "access_token" in r.json()
        # httpOnly cookie set
        assert "access_token" in r.cookies

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login",
                         json={"email": "nope@skyops.ai", "password": "wrong"})
        assert r.status_code in (401, 429)

    def test_me_no_token(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_register_new_user(self):
        email = f"test_user_{int(time.time())}@skyops.ai"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Test@1234", "name": "Tester"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == email
        assert body["access_token"]

    def test_logout(self, auth_headers):
        r = requests.post(f"{API}/auth/logout", headers=auth_headers)
        assert r.status_code == 200


# ---------- protected analytics ----------
class TestAnalytics:
    def test_overview(self, auth_headers):
        r = requests.get(f"{API}/analytics/overview", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_passengers", "satisfaction_rate", "on_time_performance",
                  "avg_service_rating", "operational_risk_index"]:
            assert k in d
        assert d["total_passengers"] > 0

    def test_satisfaction(self, auth_headers):
        r = requests.get(f"{API}/analytics/satisfaction", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "overall" in d and "by_class" in d
        assert len(d["by_class"]) >= 2

    def test_age_distribution(self, auth_headers):
        r = requests.get(f"{API}/analytics/age-distribution", headers=auth_headers)
        assert r.status_code == 200
        bands = r.json()["bands"]
        assert isinstance(bands, list) and len(bands) > 0
        assert "satisfaction_rate" in bands[0]

    def test_drivers(self, auth_headers):
        r = requests.get(f"{API}/analytics/drivers", headers=auth_headers)
        assert r.status_code == 200
        drivers = r.json()["drivers"]
        assert len(drivers) >= 10
        assert "field" in drivers[0] and "impact" in drivers[0]

    def test_conditional(self, auth_headers):
        r = requests.get(f"{API}/analytics/conditional", headers=auth_headers)
        assert r.status_code == 200
        ins = r.json()["insights"]
        assert len(ins) >= 4
        assert "probability" in ins[0] and "lift" in ins[0]

    def test_significance(self, auth_headers):
        r = requests.get(f"{API}/analytics/significance", headers=auth_headers)
        assert r.status_code == 200
        findings = r.json()["findings"]
        assert len(findings) >= 3
        assert "significant" in findings[0] and "confidence" in findings[0]

    @pytest.mark.parametrize("dim", ["class", "travel_type", "customer_type", "gender"])
    def test_compare(self, auth_headers, dim):
        r = requests.get(f"{API}/analytics/compare", params={"dimension": dim},
                         headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["dimension"] == dim
        assert len(d["segments"]) >= 2

    def test_explorer_default(self, auth_headers):
        r = requests.get(f"{API}/analytics/explorer", headers=auth_headers)
        assert r.status_code == 200
        rows = r.json()["rows"]
        assert 1 <= len(rows) <= 200

    def test_explorer_filters(self, auth_headers):
        r = requests.get(f"{API}/analytics/explorer",
                         params={"travel_class": "Business", "satisfied": 1, "limit": 25},
                         headers=auth_headers)
        assert r.status_code == 200
        rows = r.json()["rows"]
        assert all(row["travel_class"] == "Business" for row in rows)
        assert all(row["satisfied"] == 1 for row in rows)

    def test_predict(self, auth_headers):
        payload = {
            "travel_class": "Business",
            "customer_type": "Loyal",
            "travel_type": "Business",
            "seat_comfort": 5,
            "online_boarding": 5,
            "inflight_wifi": 4,
            "arrival_delay": 5,
        }
        r = requests.post(f"{API}/analytics/predict", json=payload, headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert 0 <= d["satisfaction_probability"] <= 100
        assert d["prediction"] in ("Likely Satisfied", "At Risk of Dissatisfaction")
        assert len(d["drivers"]) >= 3

    def test_predict_unauth(self):
        r = requests.post(f"{API}/analytics/predict", json={"travel_class": "Eco"})
        assert r.status_code == 401


# ---------- csv upload ----------
class TestUpload:
    def test_upload_csv_refreshes_engine(self, auth_headers):
        # build a minimal CSV with satisfaction column
        rows = ["satisfaction,travel_class,age,arrival_delay,seat_comfort,online_boarding,inflight_wifi"]
        for i in range(40):
            sat = "satisfied" if i % 2 == 0 else "neutral or dissatisfied"
            klass = "Business" if i % 2 == 0 else "Eco"
            rows.append(f"{sat},{klass},{30 + i % 20},{i % 30},{4 - i % 3},{3 + i % 3},{3}")
        csv_bytes = ("\n".join(rows)).encode("utf-8")
        files = {"file": ("TEST_upload.csv", io.BytesIO(csv_bytes), "text/csv")}
        r = requests.post(f"{API}/analytics/upload", files=files, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["rows"] >= 30
        assert "Uploaded" in d["source"]

    def test_upload_invalid_csv(self, auth_headers):
        files = {"file": ("bad.csv", io.BytesIO(b"a,b,c\n1,2,3"), "text/csv")}
        r = requests.post(f"{API}/analytics/upload", files=files, headers=auth_headers)
        assert r.status_code == 400


# ---------- live feed ----------
class TestFeed:
    def test_live_feed_shape(self, auth_headers):
        r = requests.get(f"{API}/feed/live", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["kpis", "flights", "events", "congestion"]:
            assert k in d
        for k in ["active_flights", "on_time_pct", "delayed_flights",
                  "avg_congestion", "operational_risk"]:
            assert k in d["kpis"]
        assert len(d["flights"]) > 0
        assert len(d["congestion"]) > 0

    def test_live_feed_changes(self, auth_headers):
        a = requests.get(f"{API}/feed/live", headers=auth_headers).json()
        time.sleep(0.4)
        b = requests.get(f"{API}/feed/live", headers=auth_headers).json()
        # timestamps should differ; congestion or events should drift
        assert a["timestamp"] != b["timestamp"]


# ---------- realtime pulse ----------
class TestRealtime:
    def test_pulse_shape(self, auth_headers):
        r = requests.get(f"{API}/realtime/pulse", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["timestamp", "kpis", "history", "by_class", "events",
                  "congestion", "flights", "disruption_forecast",
                  "recommendations", "source"]:
            assert k in d, f"missing {k}"
        # kpis shape
        for k in ["satisfaction_rate", "on_time_performance",
                  "operational_risk_index", "avg_service_rating",
                  "active_flights", "delayed_flights", "avg_congestion",
                  "weather_risk", "loyal_share", "business_share",
                  "total_passengers"]:
            assert k in d["kpis"], f"missing kpi {k}"
        # disruption forecast
        df = d["disruption_forecast"]
        assert 0 <= df["probability"] <= 100
        assert df["level"] in ("Low", "Elevated", "High")
        assert df["window"]
        # recommendations dynamic 1-4
        recs = d["recommendations"]
        assert isinstance(recs, list) and 1 <= len(recs) <= 4
        for rc in recs:
            assert "title" in rc and "detail" in rc and "priority" in rc
        # by_class array
        assert isinstance(d["by_class"], list) and len(d["by_class"]) >= 2
        # history bounded to 40
        assert isinstance(d["history"], list) and len(d["history"]) <= 40

    def test_pulse_unauth(self):
        r = requests.get(f"{API}/realtime/pulse")
        assert r.status_code == 401

    def test_pulse_evolves_over_time(self, auth_headers):
        """Poll the pulse twice ~7s apart; the server-side ticker (every 3s)
        should advance state so satisfaction_rate / risk / history length change."""
        a = requests.get(f"{API}/realtime/pulse", headers=auth_headers).json()
        time.sleep(7)
        b = requests.get(f"{API}/realtime/pulse", headers=auth_headers).json()
        assert a["timestamp"] != b["timestamp"]
        changed = (
            a["kpis"]["satisfaction_rate"] != b["kpis"]["satisfaction_rate"]
            or a["kpis"]["operational_risk_index"] != b["kpis"]["operational_risk_index"]
            or len(a["history"]) != len(b["history"])
            or a["history"][-1:] != b["history"][-1:]
        )
        assert changed, f"pulse did not evolve in 7s -- a={a['kpis']} b={b['kpis']}"

    def test_overview_satisfaction_reflects_live_drift(self, auth_headers):
        """overview_metrics applies engine.live_delta; should move across ticks."""
        a = requests.get(f"{API}/analytics/overview", headers=auth_headers).json()
        time.sleep(7)
        b = requests.get(f"{API}/analytics/overview", headers=auth_headers).json()
        # satisfaction_rate may drift due to live_delta
        assert a["satisfaction_rate"] != b["satisfaction_rate"] \
            or a["operational_risk_index"] != b["operational_risk_index"]


# ---------- transactional upload safety ----------
class TestUploadTransactional:
    def test_single_class_csv_rejected_without_corruption(self, auth_headers):
        # capture pre-state
        pre = requests.get(f"{API}/analytics/overview", headers=auth_headers).json()
        pre_source = pre["source"]
        # build a single-class CSV (all satisfied)
        rows = ["satisfaction,travel_class,age,arrival_delay,seat_comfort,online_boarding,inflight_wifi"]
        for i in range(40):
            rows.append(f"satisfied,Business,{30 + i % 20},{i % 30},5,5,4")
        csv_bytes = ("\n".join(rows)).encode("utf-8")
        files = {"file": ("TEST_single.csv", io.BytesIO(csv_bytes), "text/csv")}
        r = requests.post(f"{API}/analytics/upload", files=files, headers=auth_headers)
        assert r.status_code == 400, r.text
        # post-state must be unchanged: same source, satisfaction_rate in 50-80% band
        post = requests.get(f"{API}/analytics/overview", headers=auth_headers).json()
        # source should be same as before the bad upload (not changed)
        assert post["source"] == pre_source, \
            f"engine corrupted: source {pre_source!r} -> {post['source']!r}"
        # satisfaction_rate should not be 100% (would indicate corruption)
        assert post["satisfaction_rate"] < 95, \
            f"satisfaction_rate suspiciously high after bad upload: {post['satisfaction_rate']}"


# ---------- ai insights ----------
class TestAI:
    @pytest.mark.parametrize("scope", ["overview", "satisfaction", "disruption"])
    def test_ai_insights(self, auth_headers, scope):
        r = requests.post(f"{API}/ai/insights", json={"scope": scope},
                          headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["headline", "summary", "recommendations", "risk_callout", "generated_by"]:
            assert k in d, f"missing {k} in {d}"
        assert isinstance(d["recommendations"], list) and len(d["recommendations"]) >= 2
        # Real LLM should be openai:gpt-4o, not rules-engine
        assert d["generated_by"] == "openai:gpt-4o", \
            f"AI fallback hit instead of real model: {d.get('generated_by')} note={d.get('note')}"
