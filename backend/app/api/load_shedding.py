"""
Load Shedding API — Automated Load Management Endpoints
========================================================
Exposes the LoadSheddingController over FastAPI REST endpoints,
providing real-time load shedding assessment, tier summaries,
deficit simulation, and full load catalogue access.

Routes:
  GET  /api/safety/load-shedding/status?station_id=1&scenario=normal
  GET  /api/safety/load-shedding/tiers
  POST /api/safety/load-shedding/simulate
  GET  /api/safety/load-shedding/loads
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.station import Station
from app.safety.load_shedding_controller import (
    LoadSheddingController,
    POLAR_STATION_LOADS,
)
from app.simulation.data_generator import PolarDataGenerator

router = APIRouter()

# Module-level singletons
_controller = LoadSheddingController()
_sim = PolarDataGenerator()


# ─────────────────────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────────────────────

class SimulateSheddingRequest(BaseModel):
    """Body for POST /api/safety/load-shedding/simulate."""
    power_deficit_kw: float = Field(
        ..., gt=0, le=1000,
        description="Power deficit in kW to cover through load shedding"
    )
    scenario: str = Field(
        "normal",
        description="Operational scenario: normal, blizzard, fuel_critical, battery_critical, storm, fuel_low"
    )
    station_id: Optional[int] = Field(
        1,
        description="Station ID (used for context in response)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _get_station_or_404(station_id: int, db: Session) -> Station:
    """Fetch station by ID or raise 404."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")
    return station


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/load-shedding/status")
def get_load_shedding_status(
    station_id: int = Query(1, description="Station ID"),
    scenario: str = Query("normal", description="Simulation scenario (normal, storm, blizzard, …)"),
    db: Session = Depends(get_db),
):
    """
    Get current load shedding assessment for a station.

    Simulates the current station state using PolarDataGenerator,
    then runs LoadSheddingController.assess_current_state() to determine
    whether load shedding is required, which triggers are active, and
    what shed plan should be implemented.

    Query Parameters
    ----------------
    station_id : Database station ID (default 1)
    scenario   : Weather/operational scenario — affects telemetry simulation

    Returns
    -------
    Full assessment dict including:
      - status (0–3): severity level
      - status_label: NORMAL / ADVISORY / MANDATORY / EMERGENCY
      - triggers: list of active trigger conditions with SOP references
      - power_balance: current generation vs demand breakdown
      - resource_levels: fuel%, SOC%, temperature, wind speed
      - shed_plan: ordered list of loads to shed with savings estimates
      - total_sheddable_kw: maximum available savings by tier
    """
    station = _get_station_or_404(station_id, db)
    now = datetime.utcnow()

    # Generate simulated current state
    state = _sim.generate_reading(station, now, scenario)

    # Add capacity context for the controller
    state["capacity_battery_kwh"] = station.capacity_battery_kwh
    state["capacity_diesel_kw"]   = station.capacity_diesel_kw
    state["fuel_tank_liters"]     = station.fuel_tank_liters

    # Run assessment
    assessment = _controller.assess_current_state(state, station)

    # Enrich response with station and timestamp metadata
    assessment["station_id"]    = station_id
    assessment["station_code"]  = station.code
    assessment["timestamp"]     = now.isoformat()
    assessment["is_simulated"]  = True
    assessment["scenario_used"] = scenario

    # Add context about what a full emergency shed would achieve
    assessment["max_emergency_shed_context"] = {
        "tier3_full_shed_kw": _controller._tier_sheddable[3],
        "tier3_plus_tier2_kw": _controller._tier_sheddable[2] + _controller._tier_sheddable[3],
        "tier1_only_load_kw": _controller._tier_totals[1],
        "note": "Emergency (Tier 1 only) mode: station runs on ~40–65 kW for life safety",
    }

    return assessment


@router.get("/load-shedding/tiers")
def get_tier_summary():
    """
    Return the full three-tier load priority summary.

    Provides a complete breakdown of all station loads organized by tier,
    with sheddable savings potential and category grouping. This is the
    authoritative reference for operators to understand which loads fall
    in each priority category.

    Returns
    -------
    dict with three tier objects:
      - tier1: Life Safety loads (never shed)
      - tier2: Station Operations loads (emergency only)
      - tier3: Non-Essential loads (first to shed)
      - totals: aggregate counts and kW figures
    """
    summary = _controller.get_tier_summary()
    summary["ncpor_reference"] = "NCPOR Electrical Operations Standard EOS-007 (2024)"
    summary["sop_references"] = {
        "blizzard_shedding": "NCPOR SOP 4.1 — Blizzard Emergency Protocol",
        "fuel_conservation": "NCPOR SOP 7.3 — Fuel Reserve Management",
        "polar_night": "NCPOR SOP 4.2 — Polar Night Energy Conservation",
        "load_classification": "NCPOR EOS-007 — Load Priority Classification",
    }
    summary["api_timestamp"] = datetime.utcnow().isoformat()
    return summary


@router.post("/load-shedding/simulate")
def simulate_load_shedding(req: SimulateSheddingRequest, db: Session = Depends(get_db)):
    """
    Simulate load shedding for a given power deficit and scenario.

    Generates an ordered load-shedding action plan for the specified
    power deficit (in kW) and operational scenario. Useful for:
      - Planning ahead for forecast shortfalls
      - Training operators on the priority system
      - Testing what-if scenarios in the dashboard

    Request Body
    ------------
    power_deficit_kw : kW deficit to cover (required)
    scenario         : operational context (affects shed reasons in output)
    station_id       : station for context (default 1)

    Returns
    -------
    Full shed plan including:
      - actions: ordered list of loads to shed (Tier 3 first)
      - tier3_actions / tier2_actions: separated by tier
      - achievable_savings_kw: total savings from the plan
      - deficit_covered: bool — can the plan fully cover the deficit?
      - remaining_deficit_kw: any uncoverable deficit (requires demand reduction)
    """
    station = _get_station_or_404(req.station_id, db)

    plan = _controller.generate_shed_plan(req.power_deficit_kw, req.scenario)

    plan["station_id"]   = req.station_id
    plan["station_name"] = station.name
    plan["is_simulated"] = True
    plan["api_timestamp"] = datetime.utcnow().isoformat()
    plan["guidance"] = {
        "restore_order": "Restore loads in REVERSE order once conditions improve",
        "minimum_tier3_duration": "Shed Tier 3 for minimum 30 minutes before escalating to Tier 2",
        "tier2_authorization": "Tier 2 shedding requires station commander authorization",
        "log_requirement": "All shedding events must be logged in Station Log Book",
        "sop_reference": "NCPOR SOP 4.1 (blizzard), SOP 7.3 (fuel), EOS-007 (general)",
    }

    return plan


@router.get("/load-shedding/loads")
def get_all_loads(
    tier: Optional[int] = Query(None, ge=1, le=3, description="Filter by tier (1, 2, or 3)"),
    category: Optional[str] = Query(None, description="Filter by category: life_safety, station_ops, non_essential"),
):
    """
    Return the complete load catalogue with tier and category information.

    Provides all 25+ polar station loads with their power ratings,
    tier classification, sheddable savings, and descriptions.
    Supports optional filtering by tier or category.

    Query Parameters
    ----------------
    tier     : Filter to a specific tier (1, 2, or 3) — optional
    category : Filter by category string — optional

    Returns
    -------
    dict with:
      - loads: filtered list of load objects
      - count: number of loads returned
      - total_kw: sum of typical_kw for returned loads
      - tier_breakdown: counts and kW by tier
      - filter_applied: {tier, category}
    """
    loads = POLAR_STATION_LOADS

    # Apply filters
    if tier is not None:
        loads = [l for l in loads if l["tier"] == tier]
    if category is not None:
        loads = [l for l in loads if l["category"] == category]

    # Enrich with savings_potential field
    enriched_loads = []
    for load in loads:
        enriched = {**load}
        enriched["savings_potential_kw"] = (
            round(load["typical_kw"] - load["reduce_to_kw"], 1)
            if load["can_reduce"]
            else 0.0
        )
        enriched["tier_label"] = {
            1: "Life Safety (Never Shed)",
            2: "Station Operations (Emergency Only)",
            3: "Non-Essential (First to Shed)",
        }.get(load["tier"], "Unknown")
        enriched_loads.append(enriched)

    # Tier breakdown summary
    tier_breakdown = {}
    for t in [1, 2, 3]:
        tier_loads = [l for l in enriched_loads if l["tier"] == t]
        tier_breakdown[f"tier{t}"] = {
            "count": len(tier_loads),
            "total_kw": round(sum(l["typical_kw"] for l in tier_loads), 1),
            "sheddable_kw": round(sum(l["savings_potential_kw"] for l in tier_loads), 1),
        }

    return {
        "loads": enriched_loads,
        "count": len(enriched_loads),
        "total_kw": round(sum(l["typical_kw"] for l in enriched_loads), 1),
        "tier_breakdown": tier_breakdown,
        "filter_applied": {"tier": tier, "category": category},
        "ncpor_reference": "NCPOR Electrical Operations Standard EOS-007 (2024)",
        "api_timestamp": datetime.utcnow().isoformat(),
    }
