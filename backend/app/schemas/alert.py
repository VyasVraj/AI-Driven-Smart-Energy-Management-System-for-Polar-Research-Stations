from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AlertBase(BaseModel):
    station_id: int
    alert_type: str
    severity: str
    title: str
    message: str
    cause: str
    recommended_action: str

class AlertResponse(AlertBase):
    id: int
    is_acknowledged: bool
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[int] = None
    class Config:
        from_attributes = True

class AnomalyBase(BaseModel):
    station_id: int
    timestamp: datetime
    component: str
    description: str
    severity: str
    deviation_pct: float
    is_resolved: bool

class AnomalyResponse(AnomalyBase):
    id: int
    class Config:
        from_attributes = True
