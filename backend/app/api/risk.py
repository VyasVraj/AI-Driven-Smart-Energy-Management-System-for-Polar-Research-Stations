"""
Risk Assessment API — polar energy risk scoring and event generation.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.risk.risk_engine import RiskEngine
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime, timedelta
import random

router = APIRouter()
_sim = PolarDataGenerator()
_risk = RiskEngine()


@router.get("/current")
def get_current_risk(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}

    state = _sim.generate_reading(station, datetime.utcnow(), scenario)

    # Generate 6h forecast for risk prediction context
    forecast = _sim.generate_forecast(station, hours=6, scenario=scenario)

    assessment = _risk.assess_risk(state, forecast)
    assessment["station_id"] = station_id
    assessment["timestamp"] = datetime.utcnow().isoformat()
    assessment["is_simulated"] = True
    assessment["state"] = {
        "fuel_level_pct": state["fuel_level_pct"],
        "battery_soc_pct": state["battery_soc_pct"],
        "wind_speed_kmh": state["wind_speed_kmh"],
        "temperature_c": state["temperature_c"],
        "renewable_pct": state["renewable_pct"],
        "diesel_kw": state["diesel_kw"],
    }
    return assessment


@router.get("/history")
def get_risk_history(
    station_id: int = Query(1),
    hours: int = Query(48),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    gen = PolarDataGenerator()
    history = []
    for h in range(hours, 0, -1):
        ts = datetime.utcnow() - timedelta(hours=h)
        state = gen.generate_reading(station, ts)
        assessment = _risk.assess_risk(state, [])
        history.append({
            "timestamp": ts.isoformat(),
            "score": assessment["score"],
            "level": assessment["level"],
        })

    return history
