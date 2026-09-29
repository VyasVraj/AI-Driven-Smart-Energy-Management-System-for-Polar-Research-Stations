from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String
from sqlalchemy.sql import func
from app.database import Base

class EnergyReading(Base):
    __tablename__ = "energy_readings"
    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"), index=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    total_load_kw = Column(Float)
    solar_kw = Column(Float)
    wind_kw = Column(Float)
    battery_kw = Column(Float)  # positive = discharge, negative = charge
    diesel_kw = Column(Float)
    battery_soc_pct = Column(Float)
    fuel_level_pct = Column(Float)
    renewable_pct = Column(Float)
    efficiency_pct = Column(Float)
    temperature_c = Column(Float)
    wind_speed_kmh = Column(Float)
    solar_irradiance_wm2 = Column(Float)
    carbon_avoided_kg = Column(Float)
    co2_emissions_kg = Column(Float)

class WeatherReading(Base):
    __tablename__ = "weather_readings"
    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"), index=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    temperature_c = Column(Float)
    wind_speed_kmh = Column(Float)
    wind_direction_deg = Column(Float)
    solar_irradiance_wm2 = Column(Float)
    cloud_coverage_pct = Column(Float)
    humidity_pct = Column(Float)
    conditions = Column(String, default="Clear")
    storm_warning = Column(Integer, default=0)  # 0=none, 1=watch, 2=warning
