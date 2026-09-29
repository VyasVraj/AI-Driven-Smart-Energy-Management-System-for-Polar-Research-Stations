from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class SimulationRequest(BaseModel):
    station_id: int
    scenario_name: str
    parameters: Dict[str, Any]

class SimulationResponse(BaseModel):
    scenario: str
    results: Dict[str, Any]
    comparison: Dict[str, Any]
    charts_data: Dict[str, Any]

class SimulationRunResponse(BaseModel):
    id: int
    station_id: int
    user_id: Optional[int]
    scenario_name: str
    parameters: str
    results: str
    created_at: datetime
    class Config:
        from_attributes = True
