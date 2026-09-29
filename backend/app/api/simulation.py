"""
What-If Simulation API — run scenario simulations with custom parameters.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.station import Station
from app.simulation.whatif_engine import WhatIfEngine
from datetime import datetime

router = APIRouter()
_engine = WhatIfEngine()


class SimulationRequest(BaseModel):
    station_id: int = 1
    scenario_name: str = "custom"
    solar_capacity_kw: Optional[float] = None
    wind_capacity_kw: Optional[float] = None
    battery_capacity_kwh: Optional[float] = None
    load_multiplier: Optional[float] = 1.0
    temperature_c: Optional[float] = None
    fuel_level_pct: Optional[float] = None
    generator_available: Optional[bool] = True
    extreme_weather: Optional[bool] = False
    high_demand: Optional[bool] = False
    low_renewable: Optional[bool] = False


@router.post("/run")
def run_simulation(req: SimulationRequest, db: Session = Depends(get_db)):
    station = db.query(Station).filter(Station.id == req.station_id).first()
    if not station:
        return {"error": "Station not found"}

    params = {
        "solar_capacity_kw": req.solar_capacity_kw or station.capacity_solar_kw,
        "wind_capacity_kw": req.wind_capacity_kw or station.capacity_wind_kw,
        "battery_capacity_kwh": req.battery_capacity_kwh or station.capacity_battery_kwh,
        "load_multiplier": req.load_multiplier or 1.0,
        "temperature_c": req.temperature_c if req.temperature_c is not None else -20.0,
        "fuel_level_pct": req.fuel_level_pct if req.fuel_level_pct is not None else 75.0,
        "generator_available": req.generator_available if req.generator_available is not None else True,
        "extreme_weather": req.extreme_weather or False,
        "high_demand": req.high_demand or False,
        "low_renewable": req.low_renewable or False,
    }

    results = _engine.run_simulation(station, params)
    results["scenario_name"] = req.scenario_name
    results["station_id"] = req.station_id
    results["timestamp"] = datetime.utcnow().isoformat()
    results["is_simulated"] = True
    return results


@router.get("/scenarios")
def list_scenarios():
    return [
        {
            "id": "generator_failure",
            "name": "Generator Failure",
            "description": "Diesel generator is offline. System must rely on renewables and battery.",
            "icon": "⚠️",
            "params": {"generator_available": False, "fuel_level_pct": 70},
        },
        {
            "id": "extra_battery",
            "name": "+200 kWh Battery Storage",
            "description": "Additional 200 kWh battery pack added to the station.",
            "icon": "🔋",
            "params": {"battery_capacity_kwh": 800},
        },
        {
            "id": "storm",
            "name": "Blizzard Conditions",
            "description": "Severe storm with 75 km/h winds and near-zero solar radiation.",
            "icon": "🌨️",
            "params": {"extreme_weather": True, "temperature_c": -32},
        },
        {
            "id": "polar_night",
            "name": "Polar Night",
            "description": "Continuous darkness — zero solar generation for extended period.",
            "icon": "🌙",
            "params": {"low_renewable": True, "temperature_c": -35},
        },
        {
            "id": "high_demand",
            "name": "High Research Activity",
            "description": "All research equipment and laboratories running at full capacity.",
            "icon": "⚡",
            "params": {"high_demand": True, "load_multiplier": 1.45},
        },
        {
            "id": "low_fuel",
            "name": "Critical Fuel Level",
            "description": "Fuel reserves down to 15%. Emergency energy management required.",
            "icon": "⛽",
            "params": {"fuel_level_pct": 15, "generator_available": True},
        },
    ]
