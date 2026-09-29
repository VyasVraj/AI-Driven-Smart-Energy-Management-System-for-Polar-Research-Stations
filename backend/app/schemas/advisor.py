from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AdvisorRequest(BaseModel):
    station_id: int
    question: str

class AdvisorResponse(BaseModel):
    answer: str
    reasoning: str
    relevant_metrics: Dict[str, Any]
    recommended_action: Optional[str]
    confidence: float
