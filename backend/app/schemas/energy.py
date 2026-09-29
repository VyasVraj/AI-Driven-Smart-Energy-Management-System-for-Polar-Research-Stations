from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class EnergyReadingBase(BaseModel):
    station_id: int
    timestamp: datetime
    total_load_kw: float
    solar_kw: float
    wind_kw: float
    battery_kw: float
    diesel_kw: float
    battery_soc_pct: float
    fuel_level_pct: float
    renewable_pct: float
    efficiency_pct: float
    temperature_c: float
    wind_speed_kmh: float
    solar_irradiance_wm2: float
    carbon_avoided_kg: float
    co2_emissions_kg: float

class EnergyReadingResponse(EnergyReadingBase):
    id: int
    class Config:
        from_attributes = True

class WeatherReadingBase(BaseModel):
    station_id: int
    timestamp: datetime
    temperature_c: float
    wind_speed_kmh: float
    wind_direction_deg: float
    solar_irradiance_wm2: float
    cloud_coverage_pct: float
    humidity_pct: float
    conditions: str
    storm_warning: int

class WeatherReadingResponse(WeatherReadingBase):
    id: int
    class Config:
        from_attributes = True
