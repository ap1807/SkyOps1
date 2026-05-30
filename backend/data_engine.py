"""
Aviation passenger satisfaction analytics engine.

Generates a realistic synthetic dataset (Airline Passenger Satisfaction schema)
and exposes higher-level analytics that internally use descriptive statistics,
probability, conditional probability, hypothesis testing and a fitted predictive
model. To the end user these surface as operational insights, not formulas.
"""
import math
import numpy as np
import pandas as pd


# ---------------- lightweight stats helpers (no scipy/sklearn) ----------------
def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_sf(x: float) -> float:
    return 1.0 - _norm_cdf(x)


def _welch_ttest(a, b):
    """Welch's t-test; large-sample normal approximation for the p-value."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    n1, n2 = len(a), len(b)
    if n1 < 2 or n2 < 2:
        return 0.0, 1.0
    v1, v2 = a.var(ddof=1), b.var(ddof=1)
    se = math.sqrt(v1 / n1 + v2 / n2)
    if se == 0:
        return 0.0, 1.0
    t = (a.mean() - b.mean()) / se
    return float(t), float(2.0 * _norm_sf(abs(t)))


def _gser(a: float, x: float) -> float:
    gln = math.lgamma(a)
    ap = a
    s = 1.0 / a
    dl = s
    for _ in range(300):
        ap += 1.0
        dl *= x / ap
        s += dl
        if abs(dl) < abs(s) * 1e-13:
            break
    return s * math.exp(-x + a * math.log(x) - gln)


def _gcf(a: float, x: float) -> float:
    gln = math.lgamma(a)
    tiny = 1e-30
    b = x + 1.0 - a
    c = 1.0 / tiny
    d = 1.0 / b
    h = d
    for i in range(1, 300):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < tiny:
            d = tiny
        c = b + an / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        de = d * c
        h *= de
        if abs(de - 1.0) < 1e-13:
            break
    return math.exp(-x + a * math.log(x) - gln) * h


def _chi2_sf(x: float, k: float) -> float:
    """Survival function of the chi-square distribution (regularized upper incomplete gamma)."""
    if x <= 0 or k <= 0:
        return 1.0
    a, xx = k / 2.0, x / 2.0
    if xx < a + 1.0:
        return 1.0 - _gser(a, xx)
    return _gcf(a, xx)


def _chi2_contingency(ct: np.ndarray):
    ct = np.asarray(ct, dtype=float)
    total = ct.sum()
    if total == 0:
        return 0.0, 1.0
    row = ct.sum(axis=1, keepdims=True)
    col = ct.sum(axis=0, keepdims=True)
    expected = row @ col / total
    if np.any(expected == 0):
        return 0.0, 1.0
    chi2 = float(((ct - expected) ** 2 / expected).sum())
    dof = (ct.shape[0] - 1) * (ct.shape[1] - 1)
    return chi2, float(_chi2_sf(chi2, dof))


# ---------------- minimal standardizer + logistic regression (numpy only) ----------------
class _Scaler:
    def fit(self, X):
        X = np.asarray(X, dtype=float)
        self.mean = X.mean(axis=0)
        self.std = X.std(axis=0)
        self.std[self.std == 0] = 1.0
        return self

    def transform(self, X):
        return (np.asarray(X, dtype=float) - self.mean) / self.std


class _LogReg:
    """Binary logistic regression fitted via IRLS (Newton-Raphson) with L2 regularization."""

    def fit(self, X, y, iters=30, l2=1e-3):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)
        n, d = X.shape
        Xb = np.hstack([np.ones((n, 1)), X])
        w = np.zeros(d + 1)
        reg = l2 * np.eye(d + 1)
        reg[0, 0] = 0.0
        for _ in range(iters):
            z = np.clip(Xb @ w, -30, 30)
            p = 1.0 / (1.0 + np.exp(-z))
            wgt = np.clip(p * (1.0 - p), 1e-6, None)
            grad = Xb.T @ (p - y) + l2 * np.r_[0.0, w[1:]]
            H = (Xb * wgt[:, None]).T @ Xb + reg
            try:
                step = np.linalg.solve(H, grad)
            except np.linalg.LinAlgError:
                step = np.linalg.lstsq(H, grad, rcond=None)[0]
            w_new = w - step
            if np.max(np.abs(w_new - w)) < 1e-9:
                w = w_new
                break
            w = w_new
        self.intercept = float(w[0])
        self.coef = w[1:]
        return self

    def predict_proba1(self, X):
        X = np.asarray(X, dtype=float)
        z = np.clip(self.intercept + X @ self.coef, -30, 30)
        return 1.0 / (1.0 + np.exp(-z))

RNG = np.random.default_rng(42)

SERVICE_FIELDS = [
    "inflight_wifi", "online_booking", "gate_location", "food_and_drink",
    "online_boarding", "seat_comfort", "inflight_entertainment", "onboard_service",
    "legroom_service", "baggage_handling", "checkin_service", "inflight_service",
    "cleanliness", "time_convenience",
]

# Friendly labels for service fields
SERVICE_LABELS = {
    "inflight_wifi": "Inflight Wifi",
    "online_booking": "Online Booking",
    "gate_location": "Gate Location",
    "food_and_drink": "Food & Drink",
    "online_boarding": "Online Boarding",
    "seat_comfort": "Seat Comfort",
    "inflight_entertainment": "Inflight Entertainment",
    "onboard_service": "Onboard Service",
    "legroom_service": "Legroom",
    "baggage_handling": "Baggage Handling",
    "checkin_service": "Check-in Service",
    "inflight_service": "Inflight Service",
    "cleanliness": "Cleanliness",
    "time_convenience": "Schedule Convenience",
}

CLASSES = ["Business", "Eco Plus", "Eco"]


def _generate(n=9000) -> pd.DataFrame:
    gender = RNG.choice(["Male", "Female"], n)
    customer_type = RNG.choice(["Loyal", "Disloyal"], n, p=[0.72, 0.28])
    age = np.clip(RNG.normal(40, 15, n), 7, 85).astype(int)
    travel_type = RNG.choice(["Business", "Personal"], n, p=[0.62, 0.38])
    travel_class = RNG.choice(CLASSES, n, p=[0.48, 0.10, 0.42])
    flight_distance = np.clip(RNG.gamma(2.2, 550, n), 80, 4500).astype(int)

    # base service quality biased by class
    class_bias = np.select(
        [travel_class == "Business", travel_class == "Eco Plus"],
        [1.1, 0.3], default=-0.4,
    )
    ratings = {}
    for f in SERVICE_FIELDS:
        base = RNG.normal(3.0 + class_bias, 1.0, n)
        ratings[f] = np.clip(np.rint(base), 0, 5).astype(int)

    departure_delay = np.clip(RNG.exponential(14, n) - 6, 0, 600).astype(int)
    arrival_delay = np.clip(departure_delay + RNG.normal(2, 8, n), 0, 650).astype(int)

    # latent satisfaction score
    rating_matrix = np.vstack([ratings[f] for f in SERVICE_FIELDS]).T
    strong = ["online_boarding", "seat_comfort", "inflight_entertainment",
              "onboard_service", "legroom_service", "cleanliness", "inflight_wifi"]
    weights = np.array([1.6 if f in strong else 0.7 for f in SERVICE_FIELDS])
    rating_score = (rating_matrix * weights).sum(axis=1) / weights.sum()

    score = (
        0.9 * (rating_score - 3.0)
        + np.where(travel_class == "Business", 0.9, np.where(travel_class == "Eco Plus", 0.1, -0.6))
        + np.where(customer_type == "Loyal", 0.4, -0.5)
        + np.where(travel_type == "Business", 0.3, -0.2)
        - 0.010 * arrival_delay
        + 0.00012 * flight_distance
        + RNG.normal(0, 0.7, n)
    )
    prob = 1 / (1 + np.exp(-score))
    satisfied = (RNG.random(n) < prob).astype(int)

    data = {
        "gender": gender,
        "customer_type": customer_type,
        "age": age,
        "travel_type": travel_type,
        "travel_class": travel_class,
        "flight_distance": flight_distance,
        "departure_delay": departure_delay,
        "arrival_delay": arrival_delay,
        "satisfied": satisfied,
    }
    data.update(ratings)
    return pd.DataFrame(data)


class AnalyticsEngine:
    def __init__(self):
        self.df = _generate()
        self.source = "Synthetic Operational Dataset"
        self.live_delta = 0.0  # live drift (percentage points) applied to satisfaction metrics
        self._fit_model()

    # ---------------- model ----------------
    def _build_model(self, df: pd.DataFrame):
        if int(df["satisfied"].nunique()) < 2:
            raise ValueError("Dataset must contain both satisfied and dissatisfied passengers")
        X_num = df[SERVICE_FIELDS + ["age", "flight_distance", "arrival_delay"]].copy()
        X_num["is_business_class"] = (df["travel_class"] == "Business").astype(int)
        X_num["is_eco_class"] = (df["travel_class"] == "Eco").astype(int)
        X_num["is_loyal"] = (df["customer_type"] == "Loyal").astype(int)
        X_num["is_business_travel"] = (df["travel_type"] == "Business").astype(int)
        scaler = _Scaler().fit(X_num.values)
        model = _LogReg().fit(scaler.transform(X_num.values), df["satisfied"].values)
        return list(X_num.columns), scaler, model

    def _fit_model(self):
        self.feature_order, self.scaler, self.model = self._build_model(self.df)

    def load_dataframe(self, df: pd.DataFrame, source: str):
        # transactional: build artifacts first; only commit if fitting succeeds
        feature_order, scaler, model = self._build_model(df)
        self.df = df
        self.source = source
        self.feature_order, self.scaler, self.model = feature_order, scaler, model

    # ---------------- descriptive ----------------
    def _live(self, rate_pct: float) -> float:
        return round(float(np.clip(rate_pct + self.live_delta, 0, 100)), 1)

    def overview_metrics(self) -> dict:
        df = self.df
        n = len(df)
        sat_rate = float(df["satisfied"].mean())
        on_time = float((df["arrival_delay"] <= 15).mean())
        avg_rating = float(df[SERVICE_FIELDS].mean().mean())
        live_sat = self._live(sat_rate * 100)
        # operational risk: blend of dissatisfaction, delays, weak avg rating
        risk = float(np.clip(
            0.45 * (1 - live_sat / 100) + 0.35 * (1 - on_time) + 0.20 * (1 - avg_rating / 5),
            0, 1,
        ))
        return {
            "total_passengers": int(n),
            "satisfaction_rate": live_sat,
            "on_time_performance": round(on_time * 100, 1),
            "avg_service_rating": round(avg_rating, 2),
            "avg_arrival_delay": round(float(df["arrival_delay"].mean()), 1),
            "operational_risk_index": round(risk * 100, 1),
            "loyal_share": round(float((df["customer_type"] == "Loyal").mean()) * 100, 1),
            "business_share": round(float((df["travel_class"] == "Business").mean()) * 100, 1),
            "source": self.source,
        }

    def satisfaction_breakdown(self) -> dict:
        df = self.df

        def by(col):
            g = df.groupby(col)["satisfied"].agg(["mean", "count"]).reset_index()
            return [
                {"segment": str(r[col]),
                 "satisfaction_rate": self._live(float(r["mean"]) * 100),
                 "passengers": int(r["count"])}
                for _, r in g.iterrows()
            ]

        sat = int(df["satisfied"].sum())
        return {
            "overall": {"satisfied": sat, "dissatisfied": int(len(df) - sat)},
            "by_class": by("travel_class"),
            "by_travel_type": by("travel_type"),
            "by_customer_type": by("customer_type"),
        }

    def age_distribution(self) -> list:
        df = self.df
        bins = [0, 18, 25, 35, 45, 55, 65, 120]
        labels = ["<18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
        df = df.assign(band=pd.cut(df["age"], bins=bins, labels=labels, right=False))
        g = df.groupby("band", observed=True)["satisfied"].agg(["mean", "count"]).reset_index()
        return [
            {"band": str(r["band"]),
             "satisfaction_rate": round(float(r["mean"]) * 100, 1),
             "passengers": int(r["count"])}
            for _, r in g.iterrows()
        ]

    # ---------------- driver analysis (correlation) ----------------
    def satisfaction_drivers(self) -> list:
        df = self.df
        out = []
        y = df["satisfied"].values
        y_std = float(np.std(y))
        for f in SERVICE_FIELDS:
            x = df[f].values
            if y_std == 0 or float(np.std(x)) == 0:
                corr = 0.0
            else:
                corr = float(np.corrcoef(x, y)[0, 1])
            if not np.isfinite(corr):
                corr = 0.0
            sat_avg = df.loc[df["satisfied"] == 1, f].mean()
            dis_avg = df.loc[df["satisfied"] == 0, f].mean()
            out.append({
                "field": f,
                "label": SERVICE_LABELS[f],
                "impact": round(corr * 100, 1),
                "avg_satisfied": round(float(sat_avg), 2) if np.isfinite(sat_avg) else 0.0,
                "avg_dissatisfied": round(float(dis_avg), 2) if np.isfinite(dis_avg) else 0.0,
            })
        out.sort(key=lambda x: x["impact"], reverse=True)
        return out

    # ---------------- conditional probability ----------------
    def conditional_insights(self) -> list:
        df = self.df
        base = float(df["satisfied"].mean())

        def cond(mask, label):
            sub = df[mask]
            if len(sub) == 0:
                return None
            p = float(sub["satisfied"].mean())
            return {
                "condition": label,
                "probability": round(p * 100, 1),
                "lift": round((p - base) * 100, 1),
                "sample": int(len(sub)),
            }

        rows = [
            cond(df["travel_class"] == "Business", "Travelling in Business class"),
            cond(df["travel_class"] == "Eco", "Travelling in Economy class"),
            cond(df["arrival_delay"] > 60, "Arrival delayed over 60 min"),
            cond(df["arrival_delay"] <= 15, "Flight arrived on time"),
            cond(df["customer_type"] == "Loyal", "Loyal frequent flyer"),
            cond(df["online_boarding"] >= 4, "Rated online boarding highly"),
            cond(df["seat_comfort"] <= 2, "Poor seat comfort experience"),
            cond(df["inflight_wifi"] <= 2, "Poor inflight wifi experience"),
        ]
        return [r for r in rows if r]

    # ---------------- hypothesis testing ----------------
    def significance_findings(self) -> list:
        df = self.df
        findings = []

        def safe_pct(series):
            m = series.mean()
            return f"{m*100:.1f}" if len(series) and np.isfinite(m) else "—"

        # Two-proportion z-test: Business vs Eco satisfaction
        try:
            b = df[df["travel_class"] == "Business"]["satisfied"]
            e = df[df["travel_class"] == "Eco"]["satisfied"]
            if len(b) >= 5 and len(e) >= 5:
                z, p = _two_proportion_z(b, e)
                findings.append({
                    "title": "Business class drives materially higher satisfaction",
                    "metric": f"{safe_pct(b)}% vs {safe_pct(e)}%",
                    "confidence": round((1 - p) * 100, 2),
                    "significant": bool(p < 0.05),
                    "detail": "Comparison of satisfaction between Business and Economy cabins.",
                })
        except Exception:
            pass

        # t-test: arrival delay for satisfied vs dissatisfied
        try:
            d_sat = df[df["satisfied"] == 1]["arrival_delay"]
            d_dis = df[df["satisfied"] == 0]["arrival_delay"]
            if len(d_sat) >= 2 and len(d_dis) >= 2 and d_sat.std() + d_dis.std() > 0:
                t, pt = _welch_ttest(d_sat, d_dis)
                if np.isfinite(pt):
                    findings.append({
                        "title": "Arrival delays are significantly higher for unhappy passengers",
                        "metric": f"{d_dis.mean():.0f} min vs {d_sat.mean():.0f} min avg delay",
                        "confidence": round((1 - pt) * 100, 2),
                        "significant": bool(pt < 0.05),
                        "detail": "Average arrival delay experienced by dissatisfied vs satisfied passengers.",
                    })
        except Exception:
            pass

        # chi-square: customer loyalty vs satisfaction
        try:
            ct = pd.crosstab(df["customer_type"], df["satisfied"])
            if ct.shape[0] >= 2 and ct.shape[1] >= 2:
                chi2, pc = _chi2_contingency(ct.values)
                loyal = df[df["customer_type"] == "Loyal"]["satisfied"]
                findings.append({
                    "title": "Loyalty status is strongly associated with satisfaction",
                    "metric": f"{safe_pct(loyal)}% loyal satisfaction",
                    "confidence": round((1 - pc) * 100, 2),
                    "significant": bool(pc < 0.05),
                    "detail": "Association between frequent-flyer loyalty and satisfaction outcome.",
                })
        except Exception:
            pass

        return findings

    def compare_segments(self, dimension: str) -> dict:
        df = self.df
        col_map = {
            "class": "travel_class",
            "travel_type": "travel_type",
            "customer_type": "customer_type",
            "gender": "gender",
        }
        col = col_map.get(dimension, "travel_class")
        g = df.groupby(col).agg(
            satisfaction=("satisfied", "mean"),
            avg_delay=("arrival_delay", "mean"),
            avg_rating=("seat_comfort", "mean"),
            passengers=("satisfied", "count"),
        ).reset_index()
        segments = [
            {
                "segment": str(r[col]),
                "satisfaction_rate": round(float(r["satisfaction"]) * 100, 1),
                "avg_delay": round(float(r["avg_delay"]), 1),
                "passengers": int(r["passengers"]),
            }
            for _, r in g.iterrows()
        ]
        return {"dimension": dimension, "segments": segments}

    # ---------------- prediction ----------------
    def predict(self, payload: dict) -> dict:
        df = self.df
        defaults = {f: int(round(df[f].mean())) for f in SERVICE_FIELDS}
        defaults.update({
            "age": int(df["age"].mean()),
            "flight_distance": int(df["flight_distance"].mean()),
            "arrival_delay": int(df["arrival_delay"].mean()),
        })
        merged = {**defaults, **{k: v for k, v in payload.items() if v is not None}}
        travel_class = payload.get("travel_class", "Eco")
        customer_type = payload.get("customer_type", "Loyal")
        travel_type = payload.get("travel_type", "Business")

        row = {**{f: merged.get(f, defaults[f]) for f in SERVICE_FIELDS}}
        row["age"] = merged["age"]
        row["flight_distance"] = merged["flight_distance"]
        row["arrival_delay"] = merged["arrival_delay"]
        row["is_business_class"] = 1 if travel_class == "Business" else 0
        row["is_eco_class"] = 1 if travel_class == "Eco" else 0
        row["is_loyal"] = 1 if customer_type == "Loyal" else 0
        row["is_business_travel"] = 1 if travel_type == "Business" else 0

        x = np.array([[row[c] for c in self.feature_order]], dtype=float)
        prob = float(self.model.predict_proba1(self.scaler.transform(x))[0])

        # contribution-style drivers from standardized coefficients
        xs = self.scaler.transform(x)[0]
        contrib = xs * self.model.coef
        idx = np.argsort(np.abs(contrib))[::-1][:5]
        drivers = []
        nice = {
            "is_business_class": "Business class cabin",
            "is_eco_class": "Economy cabin",
            "is_loyal": "Loyal customer",
            "is_business_travel": "Business travel purpose",
            "age": "Passenger age",
            "flight_distance": "Flight distance",
            "arrival_delay": "Arrival delay",
        }
        for i in idx:
            name = self.feature_order[i]
            label = SERVICE_LABELS.get(name, nice.get(name, name))
            drivers.append({
                "factor": label,
                "direction": "positive" if contrib[i] >= 0 else "negative",
                "weight": round(float(abs(contrib[i])), 3),
            })
        return {
            "satisfaction_probability": round(prob * 100, 1),
            "prediction": "Likely Satisfied" if prob >= 0.5 else "At Risk of Dissatisfaction",
            "confidence": round(abs(prob - 0.5) * 200, 1),
            "drivers": drivers,
        }

    # ---------------- explorer ----------------
    def sample_rows(self, limit=50, travel_class=None, satisfied=None) -> list:
        df = self.df
        if travel_class:
            df = df[df["travel_class"] == travel_class]
        if satisfied in (0, 1):
            df = df[df["satisfied"] == satisfied]
        cols = ["gender", "age", "customer_type", "travel_type", "travel_class",
                "flight_distance", "arrival_delay", "seat_comfort", "online_boarding",
                "inflight_wifi", "satisfied"]
        return df[cols].head(limit).to_dict(orient="records")


def _two_proportion_z(a: pd.Series, b: pd.Series):
    n1, n2 = len(a), len(b)
    p1, p2 = a.mean(), b.mean()
    p = (a.sum() + b.sum()) / (n1 + n2)
    se = np.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    if se == 0:
        return 0.0, 1.0
    z = (p1 - p2) / se
    pval = 2 * (1 - _norm_cdf(abs(z)))
    return float(z), float(pval)


engine = AnalyticsEngine()
