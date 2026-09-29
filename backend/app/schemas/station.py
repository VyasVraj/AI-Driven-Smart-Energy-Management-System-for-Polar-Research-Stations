from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class StationBase(BaseModel):
    name: str
    code: str
    location: str
    country: str
    latitude: float
    longitude: float
    timezone: str = "UTC"
    capacity_solar_kw: float
    capacity_wind_kw: float
    capacity_battery_kwh: float
    capacity_diesel_kw: float
    fuel_tank_liters: float
    num_occupants: int
    is_active: bool = True

class StationCreate(StationBase):
    pass

class StationUpdate(StationBase):
    name: Optional[str] = None
    code: Optional[str] = None
    location: Optional[str] = None
    country: Optional[str] = None

class StationResponse(StationBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
