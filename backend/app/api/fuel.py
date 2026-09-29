"""
Fuel Management API — level, consumption rate, forecast, and AI recommendations.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime, timedelta, date
import random

router = APIRouter()
_sim = PolarDataGenerator()


@router.get("/status")
def get_fuel_status(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}

    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    fuel_pct = state["fuel_level_pct"]
    diesel_kw = state["diesel_kw"]

    fuel_liters = (fuel_pct / 100) * station.fuel_tank_liters
    consumption_rate_lh = diesel_kw * 0.25  # L/h at current output
    consumption_rate_day = consumption_rate_lh * 24

    days_remaining = (fuel_liters / consumption_rate_day) if consumption_rate_day > 0 else 9999
    exhaustion_date = (datetime.utcnow() + timedelta(days=days_remaining)).strftime("%Y-%m-%d")

    # Generator efficiency curve (% of rated)
    efficiency_pct = 85 + 10 * (diesel_kw / max(1, station.capacity_diesel_kw))

    return {
        "station_id": station_id,
        "timestamp": datetime.utcnow().isoformat(),
        "fuel_level_pct": round(fuel_pct, 1),
        "fuel_liters": round(fuel_liters, 0),
        "tank_capacity_liters": station.fuel_tank_liters,
        "diesel_kw_current": round(diesel_kw, 2),
        "consumption_rate_lh": round(consumption_rate_lh, 2),
        "consumption_rate_day_liters": round(consumption_rate_day, 1),
        "days_remaining": round(days_remaining, 1),
        "estimated_exhaustion_date": exhaustion_date,
        "generator_efficiency_pct": round(efficiency_pct, 1),
        "generator_runtime_today_hours": round(random.uniform(8, 18), 1),
        "severity": (
            "CRITICAL" if fuel_pct < 15
            else "HIGH" if fuel_pct < 25
            else "MEDIUM" if fuel_pct < 40
            else "LOW"
        ),
        "is_simulated": True,
        "scenario": scenario,
    }


@router.get("/consumption")
def get_consumption_history(
    station_id: int = Query(1),
    days: int = Query(7),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    gen = PolarDataGenerator()
    history = []
    for d in range(days - 1, -1, -1):
        day = datetime.utcnow() - timedelta(days=d)
        daily_readings = []
        for h in range(24):
            ts = day.replace(hour=h, minute=0, second=0)
            r = gen.generate_reading(station, ts, scenario)
            daily_readings.append(r)

        avg_diesel = sum(r["diesel_kw"] for r in daily_readings) / 24
        liters_consumed = avg_diesel * 0.25 * 24
        avg_renewable_pct = sum(r["renewable_pct"] for r in daily_readings) / 24

        history.append({
            "date": day.strftime("%Y-%m-%d"),
            "liters_consumed": round(liters_consumed, 1),
            "avg_diesel_kw": round(avg_diesel, 1),
            "avg_renewable_pct": round(avg_renewable_pct, 1),
            "co2_kg": round(liters_consumed * 2.68, 1),
        })
    return history


@router.get("/recommendations")
def get_fuel_recommendations(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    recs = []

    if state["battery_soc_pct"] > 50:
        recs.append({
            "priority": "HIGH",
            "action": "Discharge battery during 18:00–22:00 peak to reduce diesel runtime.",
            "estimated_saving_liters": round(state["diesel_kw"] * 0.25 * 2.5, 1),
            "estimated_co2_kg": round(state["diesel_kw"] * 0.25 * 2.5 * 2.68, 1),
        })

    if state["wind_kw"] < station.capacity_wind_kw * 0.3:
        recs.append({
            "priority": "MEDIUM",
            "action": "Wind generation is below 30% capacity. Monitor turbine health and check yaw alignment.",
            "estimated_saving_liters": 0,
            "estimated_co2_kg": 0,
        })

    if state["fuel_level_pct"] < 30:
        recs.append({
            "priority": "CRITICAL",
            "action": f"Fuel at {state['fuel_level_pct']:.1f}%. Immediately reduce non-critical loads and initiate emergency resupply request.",
            "estimated_saving_liters": 0,
            "estimated_co2_kg": 0,
        })

    if state["temperature_c"] < -25:
        recs.append({
            "priority": "MEDIUM",
            "action": "Extreme cold detected. Heating load is elevated. Consider zone-based heating control to reduce load by 10–15%.",
            "estimated_saving_liters": round(15 * 0.25 * 8, 1),
            "estimated_co2_kg": round(15 * 0.25 * 8 * 2.68, 1),
        })

    recs.append({
        "priority": "LOW",
        "action": "Schedule computing and lab equipment workloads during midday solar peak (10:00–14:00) to maximise renewable offset.",
        "estimated_saving_liters": round(random.uniform(8, 18), 1),
        "estimated_co2_kg": round(random.uniform(20, 50), 1),
    })

    return recs
