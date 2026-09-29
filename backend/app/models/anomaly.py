from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base

class Anomaly(Base):
    __tablename__ = "anomalies"
    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"), index=True)
    timestamp = Column(DateTime(timezone=True), index=True)
    component = Column(String)
    description = Column(String)
    severity = Column(String)
    deviation_pct = Column(Float)
    is_resolved = Column(Boolean, default=False)
