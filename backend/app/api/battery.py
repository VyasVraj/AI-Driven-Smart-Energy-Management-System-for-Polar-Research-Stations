"""
Battery Management API — SOC status, forecast, and charge schedule.
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


@router.get("/status")
def get_battery_status(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}

    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    soc = state["battery_soc_pct"]
    battery_kw = state["battery_kw"]

    # State of Health (degrades over simulated cycles)
    soh = round(random.uniform(88, 96), 1)
    cycles = random.randint(180, 320)
    battery_temp_c = round(state["temperature_c"] + random.uniform(8, 18), 1)  # internal heating

    available_kwh = soc / 100 * station.capacity_battery_kwh
    backup_hours = (available_kwh / max(1, state["total_load_kw"] - state["solar_kw"] - state["wind_kw"])) if state["total_load_kw"] > 0 else 0

    status = "CHARGING" if battery_kw < -5 else ("DISCHARGING" if battery_kw > 5 else "IDLE")

    return {
        "station_id": station_id,
        "timestamp": datetime.utcnow().isoformat(),
        "soc_pct": round(soc, 1),
        "soh_pct": soh,
        "battery_kw": round(battery_kw, 2),
        "status": status,
        "capacity_kwh": station.capacity_battery_kwh,
        "available_kwh": round(available_kwh, 1),
        "temperature_c": battery_temp_c,
        "charge_cycles": cycles,
        "backup_hours": round(max(0, backup_hours), 1),
        "safe_min_soc": 20,
        "safe_max_soc": 95,
        "is_in_safe_range": 20 <= soc <= 95,
        "estimated_degradation_pct_per_year": round(random.uniform(1.5, 3.0), 2),
        "is_simulated": True,
        "scenario": scenario,
    }


@router.get("/history")
def get_battery_history(
    station_id: int = Query(1),
    hours: int = Query(48),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    gen = PolarDataGenerator()
    gen._soc_state[station.id] = 72.0
    history = []
    for h in range(hours, 0, -1):
        ts = datetime.utcnow() - timedelta(hours=h)
        r = gen.generate_reading(station, ts, scenario)
        history.append({
            "timestamp": r["timestamp"],
            "soc_pct": r["battery_soc_pct"],
            "battery_kw": r["battery_kw"],
            "solar_kw": r["solar_kw"],
            "wind_kw": r["wind_kw"],
        })
    return history


@router.get("/forecast")
def get_battery_forecast(
    station_id: int = Query(1),
    hours: int = Query(24),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    gen = PolarDataGenerator()
    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    gen._soc_state[station.id] = state["battery_soc_pct"]

    forecast = []
    for h in range(1, hours + 1):
        ts = datetime.utcnow() + timedelta(hours=h)
        r = gen.generate_reading(station, ts, scenario)
        forecast.append({
            "timestamp": r["timestamp"],
            "soc_pct": r["battery_soc_pct"],
            "battery_kw": r["battery_kw"],
            "recommended_action": (
                "CHARGE" if r["solar_kw"] + r["wind_kw"] > r["total_load_kw"]
                else ("DISCHARGE" if r["battery_soc_pct"] > 60 else "HOLD")
            ),
        })
    return forecast


@router.get("/schedule")
def get_charge_schedule(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    """Return recommended 24h charge/discharge schedule."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    gen = PolarDataGenerator()
    schedule = []
    for h in range(24):
        ts = datetime.utcnow().replace(hour=h, minute=0, second=0)
        r = gen.generate_reading(station, ts, scenario)
        renewable_kw = r["solar_kw"] + r["wind_kw"]
        schedule.append({
            "hour": h,
            "renewable_kw": round(renewable_kw, 1),
            "demand_kw": round(r["total_load_kw"], 1),
            "recommended": (
                "CHARGE" if renewable_kw > r["total_load_kw"] + 20
                else ("DISCHARGE" if h in range(17, 23) else "BALANCED")
            ),
            "target_soc_pct": (85 if h in range(6, 14) else 60 if h in range(17, 23) else 70),
        })
    return schedule
