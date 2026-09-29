"""
Weather API — current conditions and 7-day forecast.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime

router = APIRouter()
_sim = PolarDataGenerator()


@router.get("/current")
def get_current_weather(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}

    weather = _sim.get_weather(station, datetime.utcnow(), scenario)
    weather["station_id"] = station_id
    weather["timestamp"] = datetime.utcnow().isoformat()
    weather["latitude"] = station.latitude
    weather["longitude"] = station.longitude
    weather["location"] = station.location
    weather["is_simulated"] = True
    return weather


@router.get("/forecast")
def get_weather_forecast(
    station_id: int = Query(1),
    days: int = Query(7),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    forecast = _sim.get_weather_forecast(station, days=days, scenario=scenario)
    for item in forecast:
        item["station_id"] = station_id
        item["is_simulated"] = True
    return forecast
