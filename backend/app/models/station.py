from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from app.database import Base

class Station(Base):
    __tablename__ = "stations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    code = Column(String, unique=True)
    location = Column(String)
    country = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    timezone = Column(String, default="UTC")
    # Capacities in kW or kWh
    capacity_solar_kw = Column(Float, default=100.0)
    capacity_wind_kw = Column(Float, default=150.0)
    capacity_battery_kwh = Column(Float, default=500.0)
    capacity_diesel_kw = Column(Float, default=300.0)
    fuel_tank_liters = Column(Float, default=50000.0)
    num_occupants = Column(Integer, default=25)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
