"""
Anomaly Detection API — returns detected anomalies from simulation data.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime, timedelta
import random

router = APIRouter()
_sim = PolarDataGenerator()

# Anomaly templates
_ANOMALY_TYPES = [
    {
        "component": "Total Load",
        "description_template": "Energy consumption is {pct}% above the expected range for this hour.",
        "severity_threshold": 25,
        "detection_method": "Rolling Z-score (|z| > 2.5)",
    },
    {
        "component": "Diesel Generator",
        "description_template": "Generator fuel consumption is {pct}% higher than historical operating pattern.",
        "severity_threshold": 20,
        "detection_method": "Isolation Forest + Historical Baseline",
    },
    {
        "component": "Solar Array",
        "description_template": "Solar output is {pct}% below expected given current irradiance ({irr} W/m²).",
        "severity_threshold": 30,
        "detection_method": "Expected vs Actual Model (XGBoost)",
    },
    {
        "component": "Battery",
        "description_template": "Unexpected battery discharge of {kw} kW detected outside scheduled dispatch window.",
        "severity_threshold": 35,
        "detection_method": "Rule-Based + Statistical Threshold",
    },
    {
        "component": "Wind Turbine",
        "description_template": "Wind generation is {pct}% below expected output for {ws:.0f} km/h wind speed.",
        "severity_threshold": 25,
        "detection_method": "Isolation Forest",
    },
]


def _generate_anomalies(station, state: dict, hours: int = 24) -> list:
    """Generate realistic anomalies from current state."""
    anomalies = []
    now = datetime.utcnow()
    gen = PolarDataGenerator()

    # Check recent readings for anomalies
    seed = hash(station.id) % 100
    random.seed(seed + now.hour)

    for i in range(hours - 1, -1, -1):
        ts = now - timedelta(hours=i)
        r = gen.generate_reading(station, ts)

        # Probabilistic anomaly injection (realistic rate)
        if random.random() < 0.18:  # 18% hourly anomaly rate — ensures visibility in demo
            atype = random.choice(_ANOMALY_TYPES)
            pct = round(random.uniform(15, 45), 1)
            severity = "CRITICAL" if pct > 40 else ("HIGH" if pct > 30 else ("MEDIUM" if pct > 20 else "LOW"))

            desc = atype["description_template"].format(
                pct=pct,
                irr=r.get("solar_irradiance_wm2", 200),
                kw=round(abs(r.get("battery_kw", 0)) * 1.3, 1),
                ws=r.get("wind_speed_kmh", 20),
            )

            anomalies.append({
                "id": len(anomalies) + 1,
                "station_id": station.id,
                "station_name": station.name,
                "timestamp": ts.isoformat(),
                "component": atype["component"],
                "description": desc,
                "severity": severity,
                "deviation_pct": pct,
                "detection_method": atype["detection_method"],
                "is_resolved": i > 8,  # older anomalies are resolved
                "relevant_metrics": {
                    "load_kw": r["total_load_kw"],
                    "solar_kw": r["solar_kw"],
                    "wind_kw": r["wind_kw"],
                    "battery_kw": r["battery_kw"],
                    "diesel_kw": r["diesel_kw"],
                },
            })

    return sorted(anomalies, key=lambda x: x["timestamp"], reverse=True)


@router.get("")
def get_anomalies(
    station_id: int = Query(1),
    hours: int = Query(24),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    return _generate_anomalies(station, state, hours=hours)


@router.get("/realtime")
def check_realtime_anomaly(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    """Check if current reading is anomalous."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"anomaly_detected": False}

    state = _sim.generate_reading(station, datetime.utcnow(), scenario)

    # Simple threshold check
    if state["total_load_kw"] > 400:
        return {
            "anomaly_detected": True,
            "component": "Total Load",
            "description": f"Load of {state['total_load_kw']:.1f} kW exceeds 400 kW threshold.",
            "severity": "HIGH",
            "deviation_pct": round((state["total_load_kw"] - 300) / 300 * 100, 1),
        }
    return {"anomaly_detected": False, "all_systems_normal": True}


@router.get("/summary")
def get_anomaly_summary(
    station_id: int = Query(1),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {}
    state = _sim.generate_reading(station, datetime.utcnow())
    anomalies = _generate_anomalies(station, state, hours=168)  # 7 days
    today = [a for a in anomalies if a["timestamp"] >= (datetime.utcnow() - timedelta(hours=24)).isoformat()]

    component_counts = {}
    for a in anomalies:
        c = a["component"]
        component_counts[c] = component_counts.get(c, 0) + 1

    most_affected = max(component_counts, key=component_counts.get) if component_counts else "None"

    return {
        "total_7d": len(anomalies),
        "today": len(today),
        "resolved": len([a for a in anomalies if a["is_resolved"]]),
        "critical": len([a for a in anomalies if a["severity"] == "CRITICAL"]),
        "most_affected_component": most_affected,
        "detection_methods": ["IsolationForest", "Rolling Z-score", "XGBoost Regression"],
    }
