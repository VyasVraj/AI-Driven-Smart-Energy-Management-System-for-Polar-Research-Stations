"""
MPC Optimizer API — Model Predictive Control endpoints
======================================================
Exposes the MPCController and MILPOptimizer over FastAPI REST endpoints,
allowing the frontend to request optimised 24-hour dispatch plans, rolling
schedules, and custom MILP solutions with user-supplied forecasts.

Routes:
  GET  /api/mpc/optimize?station_id=1&horizon_hours=24
  GET  /api/mpc/rolling-schedule?station_id=1
  POST /api/mpc/custom-plan
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.station import Station
from app.optimization.mpc_controller import MPCController
from app.optimization.milp_optimizer import MILPOptimizer
from app.simulation.data_generator import PolarDataGenerator

router = APIRouter()

# Module-level singletons (thread-safe for read-only controllers)
_mpc = MPCController()
_milp = MILPOptimizer()
_sim = PolarDataGenerator()


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class CustomPlanRequest(BaseModel):
    """Body for POST /api/mpc/custom-plan."""
    station_id: int = Field(1, description="Station ID to optimize for")
    solar_forecast: list[float] = Field(
        ...,
        min_length=24,
        max_length=24,
        description="24-hour solar generation forecast (kW per hour)"
    )
    wind_forecast: list[float] = Field(
        ...,
        min_length=24,
        max_length=24,
        description="24-hour wind generation forecast (kW per hour)"
    )
    demand_forecast: list[float] = Field(
        ...,
        min_length=24,
        max_length=24,
        description="24-hour demand forecast (kW per hour)"
    )
    battery_soc_init: float = Field(
        72.0, ge=0, le=100,
        description="Initial battery SOC (%)"
    )
    fuel_level_pct: float = Field(
        80.0, ge=0, le=100,
        description="Current fuel tank level (%)"
    )
    temperature_c: float = Field(
        -20.0,
        description="Ambient temperature (°C) — affects battery derating"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────────────────────────────────────

def _get_station_or_404(station_id: int, db: Session) -> Station:
    """Fetch a station by ID or raise HTTP 404."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail=f"Station {station_id} not found")
    return station


def _build_mpc_current_state(station: Station, scenario: str = "normal") -> dict:
    """
    Generate a current_state dict compatible with MPCController.run_mpc_step()
    using the PolarDataGenerator to simulate live telemetry.
    """
    now = datetime.utcnow()
    state = _sim.generate_reading(station, now, scenario)

    # Augment with fields expected by the original MPCController sinusoidal model
    state["hour_of_day"]          = now.hour
    state["day_of_year"]          = now.timetuple().tm_yday
    state["battery_soc_init"]     = state["battery_soc_pct"]
    state["battery_capacity_kwh"] = station.capacity_battery_kwh
    state["fuel_tank_liters"]     = station.fuel_tank_liters
    state["genset_rated_kw"]      = station.capacity_diesel_kw
    state["capacity_diesel_kw"]   = station.capacity_diesel_kw
    state["scenario"]             = scenario

    return state


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/optimize")
def optimize(
    station_id: int = Query(1, description="Station ID"),
    horizon_hours: int = Query(24, ge=1, le=24, description="MPC planning horizon (hours)"),
    scenario: str = Query("normal", description="Simulation scenario (normal, storm, polar_night, …)"),
    db: Session = Depends(get_db),
):
    """
    Run one MPC optimization step for a station.

    Generates a synthetic weather/demand forecast for the next ``horizon_hours``
    hours, solves the MILP dispatch LP, and returns the full optimised plan
    alongside control actions and a next-3h rolling summary.

    Query Parameters
    ----------------
    station_id    : Database station ID (default 1)
    horizon_hours : Planning horizon in hours 1–24 (default 24)
    scenario      : Weather/operational scenario for the simulation

    Returns
    -------
    Full MPC plan dict including:
      - current_state_summary: live telemetry snapshot
      - optimized_plan: 24-hour hourly schedule + summary metrics
      - rolling_next_3h: next 3 hours with recommended actions
      - control_actions: prioritized immediate action list
      - explanation: human-readable plan narrative
      - forecast_used: forecast totals used by the optimizer
    """
    station = _get_station_or_404(station_id, db)
    current_state = _build_mpc_current_state(station, scenario)

    # Call the existing MPCController which has a dual API:
    # - new API: run_mpc_step(station_obj, current_state, horizon_hours)
    # - original API: run_mpc_step(station_name_str, state_dict)
    # We use the original API for backwards compatibility since the controller
    # already exists and works with string station names.
    try:
        plan = _mpc.run_mpc_step(
            station=station.name,
            current_state=current_state,
            horizon_hours=horizon_hours,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"MPC optimization failed: {exc}")

    # Enrich with station context
    plan["station_id"]   = station_id
    plan["station_name"] = station.name
    plan["station_code"] = station.code
    plan["capacity"] = {
        "solar_kw":    station.capacity_solar_kw,
        "wind_kw":     station.capacity_wind_kw,
        "battery_kwh": station.capacity_battery_kwh,
        "diesel_kw":   station.capacity_diesel_kw,
    }
    plan["is_simulated"] = True
    plan["api_timestamp"] = datetime.utcnow().isoformat()

    return plan


@router.get("/rolling-schedule")
def rolling_schedule(
    station_id: int = Query(1, description="Station ID"),
    scenario: str = Query("normal", description="Simulation scenario"),
    db: Session = Depends(get_db),
):
    """
    Return a rolling MPC schedule with educational explanation.

    Identical to /optimize but wraps the result with a plain-language
    explanation of the receding-horizon MPC concept, suitable for display
    in the operator dashboard.

    Returns
    -------
    Full MPC plan dict plus:
      - rolling_horizon_explanation: plain-language description of MPC
      - condensed_schedule: key decision points every 4 hours (for overview)
      - summary_metrics: aggregated 24h metrics for dashboard cards
    """
    station = _get_station_or_404(station_id, db)
    current_state = _build_mpc_current_state(station, scenario)

    try:
        plan = _mpc.get_rolling_schedule(
            station=station.name,
            current_state=current_state,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Rolling schedule failed: {exc}")

    # Build a condensed view of the schedule (key hours: 0,4,8,12,16,20,23)
    full_schedule = plan.get("hourly_schedule", [])
    key_hours = list(range(0, min(6, len(full_schedule)))) + list(range(6, len(full_schedule), 4))
    condensed = [full_schedule[h] for h in key_hours if h < len(full_schedule)]

    # Summary metrics for dashboard cards
    summary_metrics = {
        "total_fuel_liters_24h":   plan.get("total_fuel_liters", 0),
        "renewable_fraction_pct":  plan.get("renewable_fraction_pct", 0),
        "diesel_runtime_hours":    plan.get("diesel_runtime_hours", 0),
        "co2_kg_24h":              plan.get("total_co2_kg", 0),
        "fuel_savings_liters":     plan.get("fuel_savings_vs_baseline_liters", 0),
        "co2_savings_kg":          plan.get("co2_savings_vs_baseline_kg", 0),
        "min_soc_pct":             plan.get("min_soc_pct", 0),
        "peak_soc_pct":            plan.get("peak_soc_pct", 0),
        "solver_status":           plan.get("solver_status", "unknown"),
    }

    plan["station_id"]       = station_id
    plan["condensed_schedule"] = condensed
    plan["summary_metrics"]  = summary_metrics
    plan["is_simulated"]     = True
    plan["api_timestamp"]    = datetime.utcnow().isoformat()

    return plan


@router.post("/custom-plan")
def custom_plan(
    req: CustomPlanRequest,
    db: Session = Depends(get_db),
):
    """
    Run MILP optimization with user-supplied forecasts.

    Allows the operator or frontend to provide custom solar, wind, and demand
    forecasts and receive an optimised 24-hour dispatch plan. This is useful
    for what-if scenario analysis (e.g., "what if wind drops to 0 all day?").

    Request Body
    ------------
    See ``CustomPlanRequest`` schema above.

    Returns
    -------
    Full MILP plan including:
      - hourly_schedule: 24-hour optimised dispatch
      - total_fuel_liters: forecast diesel fuel use
      - total_co2_kg: forecast CO2 emissions
      - renewable_fraction_pct: percentage of load from renewables
      - fuel_savings_vs_baseline_liters: savings vs all-diesel baseline
      - solver_status: "optimal", "fallback_greedy", or "error"
      - input_summary: echo of inputs for verification
    """
    station = _get_station_or_404(req.station_id, db)

    milp_state = {
        "solar_forecast":       req.solar_forecast,
        "wind_forecast":        req.wind_forecast,
        "demand_forecast":      req.demand_forecast,
        "battery_soc_init":     req.battery_soc_init,
        "battery_capacity_kwh": station.capacity_battery_kwh,
        "fuel_level_pct":       req.fuel_level_pct,
        "fuel_tank_liters":     station.fuel_tank_liters,
        "temperature_c":        req.temperature_c,
        "genset_rated_kw":      station.capacity_diesel_kw,
    }

    try:
        plan = _milp.solve_24h_plan(milp_state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"MILP solve failed: {exc}")

    plan["station_id"]   = req.station_id
    plan["station_name"] = station.name
    plan["is_custom"]    = True
    plan["is_simulated"] = True
    plan["api_timestamp"] = datetime.utcnow().isoformat()

    # Echo back key inputs for verification
    plan["input_summary"] = {
        "solar_total_kwh":    round(sum(req.solar_forecast), 1),
        "wind_total_kwh":     round(sum(req.wind_forecast), 1),
        "demand_total_kwh":   round(sum(req.demand_forecast), 1),
        "battery_soc_init":   req.battery_soc_init,
        "fuel_level_pct":     req.fuel_level_pct,
        "temperature_c":      req.temperature_c,
        "station_capacity": {
            "battery_kwh": station.capacity_battery_kwh,
            "diesel_kw":   station.capacity_diesel_kw,
        },
    }

    return plan
