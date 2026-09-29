"""
Energy Optimization API — compute and return optimal dispatch recommendation.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.optimization.energy_optimizer import EnergyOptimizer
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime

router = APIRouter()
_sim = PolarDataGenerator()
_opt = EnergyOptimizer()


@router.get("/recommendation")
def get_recommendation(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}

    state = _sim.generate_reading(station, datetime.utcnow(), scenario)

    dispatch_state = {
        "solar_available": state["solar_kw"],
        "wind_available": state["wind_kw"],
        "battery_soc": state["battery_soc_pct"],
        "battery_capacity": station.capacity_battery_kwh,
        "fuel_level": state["fuel_level_pct"],
        "fuel_tank_liters": station.fuel_tank_liters,
        "current_demand": state["total_load_kw"],
        "temperature": state["temperature_c"],
        "scenario": scenario,
    }

    result = _opt.compute_optimal_dispatch(dispatch_state)

    # Add current vs recommended comparison
    current_renewable = state["solar_kw"] + state["wind_kw"]
    current_total = state["total_load_kw"]
    result["current_mix"] = {
        "solar_pct": round(state["solar_kw"] / current_total * 100, 1) if current_total else 0,
        "wind_pct": round(state["wind_kw"] / current_total * 100, 1) if current_total else 0,
        "battery_pct": round(max(0, state["battery_kw"]) / current_total * 100, 1) if current_total else 0,
        "diesel_pct": round(state["diesel_kw"] / current_total * 100, 1) if current_total else 0,
    }
    result["station_id"] = station_id
    result["timestamp"] = datetime.utcnow().isoformat()
    result["total_demand_kw"] = round(state["total_load_kw"], 2)
    result["is_simulated"] = True

    return result


@router.get("/history")
def get_optimization_history(
    station_id: int = Query(1),
    limit: int = Query(10),
    db: Session = Depends(get_db)
):
    """Return last N optimization recommendations (simulated)."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    import random
    from datetime import timedelta
    gen = PolarDataGenerator()
    history = []
    for i in range(limit):
        ts = datetime.utcnow() - timedelta(hours=i * 6)
        state = gen.generate_reading(station, ts)
        state_dict = {
            "solar_available": state["solar_kw"],
            "wind_available": state["wind_kw"],
            "battery_soc": state["battery_soc_pct"],
            "battery_capacity": station.capacity_battery_kwh,
            "fuel_level": state["fuel_level_pct"],
            "fuel_tank_liters": station.fuel_tank_liters,
            "current_demand": state["total_load_kw"],
            "temperature": state["temperature_c"],
        }
        rec = _opt.compute_optimal_dispatch(state_dict)
        history.append({
            "timestamp": ts.isoformat(),
            "recommended_mix": rec,
            "diesel_saved_liters": rec["expected_savings"]["diesel_liters"],
            "co2_saved_kg": rec["expected_savings"]["co2_kg"],
        })

    return sorted(history, key=lambda x: x["timestamp"], reverse=True)
