from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.database import Base

class SimulationRun(Base):
    __tablename__ = "simulation_runs"
    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    scenario_name = Column(String)
    parameters = Column(Text)  # JSON string
    results = Column(Text)  # JSON string
    created_at = Column(DateTime(timezone=True), server_default=func.now())
