"""
AI Advisor API — context-aware natural language Q&A for station operators.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.schemas.advisor import AdvisorRequest, AdvisorResponse
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime

router = APIRouter()
_sim = PolarDataGenerator()

# RAG-enhanced advisor (SIH upgrade) — falls back to template if not yet built
try:
    from app.rag.rag_advisor import RAGAdvisor
    _rag = RAGAdvisor()
    _RAG_AVAILABLE = True
except ImportError:
    _rag = None
    _RAG_AVAILABLE = False



def _get_station_state(station, scenario: str = "normal") -> dict:
    return _sim.generate_reading(station, datetime.utcnow(), scenario)


# Knowledge base: each entry maps keyword patterns → response builder
_RESPONSE_TEMPLATES = {
    "fuel": {
        "keywords": ["fuel", "diesel", "refuel", "tank", "generator"],
        "answer_fn": lambda state, station: (
            f"Current fuel level at {station.name} is **{state['fuel_level_pct']:.1f}%**. "
            f"At the current diesel consumption rate of **{state['diesel_kw'] * 0.25:.1f} L/h**, "
            f"the estimated fuel remaining is **{(state['fuel_level_pct'] / 100 * station.fuel_tank_liters) / max(1, state['diesel_kw'] * 0.25):.0f} hours "
            f"({(state['fuel_level_pct'] / 100 * station.fuel_tank_liters) / max(1, state['diesel_kw'] * 0.25) / 24:.1f} days)**."
        ),
        "reasoning_fn": lambda state: (
            f"Diesel generator is currently producing {state['diesel_kw']:.1f} kW. "
            f"Renewable sources (Solar: {state['solar_kw']:.1f} kW + Wind: {state['wind_kw']:.1f} kW) "
            f"are covering {state['renewable_pct']:.1f}% of load. "
            f"Higher diesel dependency is observed when renewable generation is low."
        ),
        "action_fn": lambda state: (
            "Increase battery discharge during peak hours to reduce diesel runtime. "
            "Consider scheduling non-critical loads to off-peak periods."
            if state['battery_soc_pct'] > 40
            else "Battery reserve is low. Maintain current diesel operation and plan resupply if fuel < 20%."
        ),
        "metrics_fn": lambda state: {
            "fuel_level_pct": state['fuel_level_pct'],
            "diesel_kw": state['diesel_kw'],
            "renewable_pct": state['renewable_pct'],
            "battery_soc_pct": state['battery_soc_pct'],
        }
    },
    "battery": {
        "keywords": ["battery", "soc", "charge", "discharge", "storage", "backup"],
        "answer_fn": lambda state, station: (
            f"Battery State of Charge is **{state['battery_soc_pct']:.1f}%** "
            f"({state['battery_soc_pct'] / 100 * station.capacity_battery_kwh:.0f} kWh of {station.capacity_battery_kwh:.0f} kWh). "
            f"{'⚠️ Battery is in a low-reserve state — critical loads may be at risk if renewable generation drops.' if state['battery_soc_pct'] < 25 else '✅ Battery reserve is healthy and within safe operating limits.'}"
        ),
        "reasoning_fn": lambda state: (
            f"Current battery flow: {'+' if state['battery_kw'] < 0 else ''}{-state['battery_kw']:.1f} kW "
            f"({'charging from excess renewable' if state['battery_kw'] < 0 else 'discharging to support load'}). "
            f"Safe operating range: 20%–95% SOC."
        ),
        "action_fn": lambda state: (
            "⚠️ Activate diesel backup immediately. Battery below safe threshold."
            if state['battery_soc_pct'] < 20
            else "Monitor battery temperature and ensure charge cycles are optimised."
        ),
        "metrics_fn": lambda state: {
            "battery_soc_pct": state['battery_soc_pct'],
            "battery_kw": state['battery_kw'],
            "solar_kw": state['solar_kw'],
            "wind_kw": state['wind_kw'],
        }
    },
    "generator": {
        "keywords": ["generator", "diesel gen", "run generator", "start gen", "run diesel"],
        "answer_fn": lambda state, station: (
            f"{'The diesel generator is currently online at ' + str(round(state['diesel_kw'], 1)) + ' kW.' if state['diesel_kw'] > 5 else 'The diesel generator is currently offline. Renewable sources and battery are covering full load.'} "
            f"Generator efficiency is estimated at **{85 + (state['diesel_kw'] / station.capacity_diesel_kw * 10):.1f}%** at current load."
        ),
        "reasoning_fn": lambda state: (
            f"Total demand: {state['total_load_kw']:.1f} kW. "
            f"Renewables providing {state['renewable_pct']:.1f}%. "
            f"Battery SOC at {state['battery_soc_pct']:.1f}% "
            f"{'— battery can absorb more load reduction before diesel is needed.' if state['battery_soc_pct'] > 50 else '— battery approaching lower threshold.'}"
        ),
        "action_fn": lambda state: (
            "Running diesel is not recommended right now — battery discharge can cover the deficit for at least 2 more hours."
            if state['battery_soc_pct'] > 45 and state['diesel_kw'] < 50
            else "Diesel generator should remain online to protect critical loads."
        ),
        "metrics_fn": lambda state: {
            "diesel_kw": state['diesel_kw'],
            "total_load_kw": state['total_load_kw'],
            "renewable_pct": state['renewable_pct'],
            "battery_soc_pct": state['battery_soc_pct'],
        }
    },
    "renewable": {
        "keywords": ["solar", "wind", "renewable", "clean energy", "green", "tomorrow"],
        "answer_fn": lambda state, station: (
            f"Current renewable output: Solar **{state['solar_kw']:.1f} kW** + Wind **{state['wind_kw']:.1f} kW** = "
            f"**{state['solar_kw'] + state['wind_kw']:.1f} kW** ({state['renewable_pct']:.1f}% of load). "
            f"Solar irradiance is {state['solar_irradiance_wm2']:.0f} W/m². "
            f"Wind speed is {state['wind_speed_kmh']:.1f} km/h."
        ),
        "reasoning_fn": lambda state: (
            f"Temperature: {state['temperature_c']:.1f}°C. "
            f"Cloud coverage: {state.get('cloud_coverage_pct', 20):.0f}%. "
            f"{'Polar night conditions are limiting solar generation.' if state['solar_kw'] < 5 else 'Solar panels are operating within normal range.'}"
        ),
        "action_fn": lambda state: (
            "Take advantage of current high renewable output to charge batteries before evening demand peak."
            if state['renewable_pct'] > 60
            else "Renewable availability is below 60%. Maintain diesel readiness and conserve battery reserves."
        ),
        "metrics_fn": lambda state: {
            "solar_kw": state['solar_kw'],
            "wind_kw": state['wind_kw'],
            "renewable_pct": state['renewable_pct'],
            "solar_irradiance_wm2": state['solar_irradiance_wm2'],
            "wind_speed_kmh": state['wind_speed_kmh'],
        }
    },
    "risk": {
        "keywords": ["risk", "warning", "critical", "danger", "alert", "high risk"],
        "answer_fn": lambda state, station: (
            f"Current energy risk assessment for {station.name}: "
            f"{'🔴 CRITICAL' if state['fuel_level_pct'] < 15 or state['battery_soc_pct'] < 15 else '🟡 MEDIUM' if state['fuel_level_pct'] < 30 or state['battery_soc_pct'] < 30 else '🟢 LOW'}. "
            f"Key risk factors: Fuel {state['fuel_level_pct']:.1f}%, Battery {state['battery_soc_pct']:.1f}%."
        ),
        "reasoning_fn": lambda state: (
            f"Risk score driven by: "
            f"fuel level ({state['fuel_level_pct']:.1f}%), "
            f"battery SOC ({state['battery_soc_pct']:.1f}%), "
            f"wind speed ({state['wind_speed_kmh']:.1f} km/h), "
            f"temperature ({state['temperature_c']:.1f}°C)."
        ),
        "action_fn": lambda state: (
            "🚨 Immediate action required: Protect critical loads, activate backup power, and contact logistics for emergency fuel resupply."
            if state['fuel_level_pct'] < 15 or state['battery_soc_pct'] < 15
            else "Monitor risk metrics closely. Review optimization recommendations to reduce diesel dependency."
        ),
        "metrics_fn": lambda state: {
            "fuel_level_pct": state['fuel_level_pct'],
            "battery_soc_pct": state['battery_soc_pct'],
            "wind_speed_kmh": state['wind_speed_kmh'],
            "temperature_c": state['temperature_c'],
            "renewable_pct": state['renewable_pct'],
        }
    },
    "reduce_consumption": {
        "keywords": ["reduce", "save", "consumption", "efficiency", "cut", "lower", "decrease"],
        "answer_fn": lambda state, station: (
            f"To reduce energy consumption at {station.name} (currently {state['total_load_kw']:.1f} kW), "
            f"the highest-impact actions are: "
            f"(1) Defer non-critical lab equipment during peak hours (18:00–22:00), "
            f"(2) Optimise heating setpoints by 2°C during low-occupancy periods, "
            f"(3) Schedule computing workloads during high renewable availability windows."
        ),
        "reasoning_fn": lambda state: (
            f"Current load breakdown: Base {150:.0f} kW, Heating ~{max(0, (-5 - state['temperature_c']) * 5):.0f} kW, "
            f"Research equipment ~{state['total_load_kw'] - 150 - max(0, (-5 - state['temperature_c']) * 5):.0f} kW. "
            f"Temperature is {state['temperature_c']:.1f}°C — heating load is {'significant' if state['temperature_c'] < -15 else 'moderate'}."
        ),
        "action_fn": lambda state: (
            "Implement load shifting for non-critical systems. Estimated saving: 15–25 kW during peak hours."
        ),
        "metrics_fn": lambda state: {
            "total_load_kw": state['total_load_kw'],
            "temperature_c": state['temperature_c'],
            "diesel_kw": state['diesel_kw'],
            "battery_soc_pct": state['battery_soc_pct'],
        }
    },
}

_DEFAULT_RESPONSE = {
    "answer": "I can analyse energy conditions at the polar research station and provide recommendations.",
    "reasoning": "Please ask about fuel, battery, renewable energy, generator, risk levels, or how to reduce consumption.",
    "relevant_metrics": {},
    "recommended_action": "Try asking: 'Why is fuel consumption high?' or 'What is the current battery status?'",
    "confidence": 0.70,
}


@router.post("/query", response_model=AdvisorResponse)
def advisor_query(req: AdvisorRequest, db: Session = Depends(get_db)):
    station_id = getattr(req, "station_id", 1)
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        station = db.query(Station).first()
    if not station:
        return AdvisorResponse(**_DEFAULT_RESPONSE)

    state = _get_station_state(station)
    q = req.question.lower()

    # ── Try RAG-enhanced advisor first (SIH upgrade) ─────────────────────────
    if _RAG_AVAILABLE and _rag is not None:
        try:
            rag_result = _rag.answer(req.question, state)
            return AdvisorResponse(
                answer=rag_result.get("answer", ""),
                reasoning=rag_result.get("reasoning", ""),
                relevant_metrics={m["label"]: m["value"] for m in rag_result.get("key_metrics", [])},
                recommended_action=" | ".join(rag_result.get("action_items", [])),
                confidence=rag_result.get("confidence", 0.88),
            )
        except Exception as e:
            print(f"[RAG Advisor] Error, falling back to template: {e}")

    # ── Fallback: Template-based response matching ────────────────────────────
    matched = None
    for key, tmpl in _RESPONSE_TEMPLATES.items():
        if any(kw in q for kw in tmpl["keywords"]):
            matched = tmpl
            break

    if matched is None:
        return AdvisorResponse(
            answer=_DEFAULT_RESPONSE["answer"],
            reasoning=_DEFAULT_RESPONSE["reasoning"],
            relevant_metrics={"total_load_kw": state["total_load_kw"], "renewable_pct": state["renewable_pct"]},
            recommended_action=_DEFAULT_RESPONSE["recommended_action"],
            confidence=0.65,
        )

    return AdvisorResponse(
        answer=matched["answer_fn"](state, station),
        reasoning=matched["reasoning_fn"](state),
        relevant_metrics=matched["metrics_fn"](state),
        recommended_action=matched["action_fn"](state),
        confidence=0.91,
    )



@router.get("/suggestions")
def get_suggestions(station_id: int = Query(1)):
    """Return predefined question suggestions for the UI."""
    return [
        "Why is diesel consumption high today?",
        "What will happen if battery SOC falls below 20%?",
        "Should we run the diesel generator now?",
        "How much renewable energy is expected tomorrow?",
        "Why did the risk level become HIGH?",
        "What can we do to reduce fuel consumption?",
        "What is the current battery status?",
        "How is solar generation affected by current weather?",
        # SIH upgrade questions (RAG-enabled)
        "What does the blizzard emergency protocol say about load shedding?",
        "What is the wet stacking risk with the diesel generator at current load?",
        "How does the Antarctic Treaty affect our fuel usage?",
        "What is the battery cold weather derating at current temperature?",
        "Explain the MPC 24-hour optimization plan for today",
    ]


@router.get("/rag-status")
def get_rag_status():
    """Check if RAG knowledge base is active (SIH upgrade indicator)."""
    if _RAG_AVAILABLE and _rag is not None:
        try:
            categories = _rag.kb.get_all_categories()
            doc_count = getattr(_rag.kb, "document_count", 15)
            return {
                "rag_active": True,
                "knowledge_documents": doc_count,
                "categories": categories,
                "advisor_mode": "RAG-Enhanced (NCPOR Knowledge Base)",
                "description": "Answers grounded in official NCPOR SOPs, Antarctic Treaty guidelines, and live station telemetry",
            }
        except Exception:
            pass
    return {
        "rag_active": False,
        "advisor_mode": "Template-Based",
        "description": "Keyword-matched template responses",
    }
