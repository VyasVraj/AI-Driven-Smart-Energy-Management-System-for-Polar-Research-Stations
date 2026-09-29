"""
Station API — list stations with live energy snapshot.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from app.risk.risk_engine import RiskEngine
from datetime import datetime

router = APIRouter()
_sim = PolarDataGenerator()
_risk = RiskEngine()


def _station_with_status(station, scenario: str = "normal") -> dict:
    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    risk  = _risk.assess_risk(state, [])
    return {
        "id": station.id,
        "name": station.name,
        "code": station.code,
        "location": station.location,
        "country": station.country,
        "latitude": station.latitude,
        "longitude": station.longitude,
        "capacity_solar_kw": station.capacity_solar_kw,
        "capacity_wind_kw": station.capacity_wind_kw,
        "capacity_battery_kwh": station.capacity_battery_kwh,
        "capacity_diesel_kw": station.capacity_diesel_kw,
        "fuel_tank_liters": station.fuel_tank_liters,
        "num_occupants": station.num_occupants,
        "is_active": station.is_active,
        # Live snapshot
        "live": {
            "total_load_kw": state["total_load_kw"],
            "solar_kw": state["solar_kw"],
            "wind_kw": state["wind_kw"],
            "diesel_kw": state["diesel_kw"],
            "battery_soc_pct": state["battery_soc_pct"],
            "fuel_level_pct": state["fuel_level_pct"],
            "renewable_pct": state["renewable_pct"],
            "temperature_c": state["temperature_c"],
            "wind_speed_kmh": state["wind_speed_kmh"],
            "conditions": state.get("conditions", "Clear"),
        },
        "risk_level": risk["level"],
        "risk_score": risk["score"],
        "is_simulated": True,
    }


@router.get("")
def get_stations(
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    stations = db.query(Station).filter(Station.is_active == True).all()
    return [_station_with_status(s, scenario) for s in stations]


@router.get("/{station_id}")
def get_station(
    station_id: int,
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        from fastapi import HTTPException
        raise HTTPException(404, "Station not found")
    return _station_with_status(station, scenario)
