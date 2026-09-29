"""
Renewable Energy Forecasting API — solar and wind generation predictions.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime
import random

router = APIRouter()
_sim = PolarDataGenerator()


@router.get("/forecast")
def get_renewable_forecast(
    station_id: int = Query(1),
    hours: int = Query(24),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    forecast = _sim.generate_forecast(station, hours=hours, scenario=scenario)

    results = []
    total_solar = 0
    total_wind = 0
    total_load = 0

    for item in forecast:
        solar_kw = item["solar_kw"]
        wind_kw = item["wind_kw"]
        load_kw = item["total_load_kw"]
        renewable_total = solar_kw + wind_kw
        coverage_pct = min(100, renewable_total / load_kw * 100) if load_kw > 0 else 100

        total_solar += solar_kw
        total_wind += wind_kw
        total_load += load_kw

        results.append({
            "timestamp": item["timestamp"],
            "solar_kw": round(solar_kw, 2),
            "wind_kw": round(wind_kw, 2),
            "renewable_total_kw": round(renewable_total, 2),
            "demand_kw": round(load_kw, 2),
            "renewable_coverage_pct": round(coverage_pct, 1),
            "horizon_hours": item["horizon_hours"],
            "confidence": item["confidence"],
        })

    # Summary
    avg_load = total_load / len(results) if results else 1
    avg_renewable = (total_solar + total_wind) / len(results) if results else 0

    return {
        "station_id": station_id,
        "horizon_hours": hours,
        "scenario": scenario,
        "is_simulated": True,
        "model": {"solar": "XGBoost Regressor", "wind": "Random Forest"},
        "predictions": results,
        "summary": {
            "avg_solar_kw": round(total_solar / len(results), 2) if results else 0,
            "avg_wind_kw": round(total_wind / len(results), 2) if results else 0,
            "avg_renewable_kw": round(avg_renewable, 2),
            "avg_demand_kw": round(avg_load, 2),
            "avg_renewable_coverage_pct": round(avg_renewable / avg_load * 100, 1) if avg_load > 0 else 0,
            "hours_renewable_covers_demand": sum(1 for r in results if r["renewable_coverage_pct"] >= 100),
        }
    }


@router.get("/history")
def get_renewable_history(
    station_id: int = Query(1),
    hours: int = Query(24),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    gen = PolarDataGenerator()
    from datetime import timedelta
    history = []
    for h in range(hours, 0, -1):
        ts = datetime.utcnow() - timedelta(hours=h)
        r = gen.generate_reading(station, ts, scenario)
        history.append({
            "timestamp": r["timestamp"],
            "solar_kw": r["solar_kw"],
            "wind_kw": r["wind_kw"],
            "total_load_kw": r["total_load_kw"],
            "renewable_pct": r["renewable_pct"],
        })
    return history
