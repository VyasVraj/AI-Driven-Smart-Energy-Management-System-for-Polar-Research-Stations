"""
mpc_controller.py
=================
Model Predictive Control (MPC) wrapper for the Polaris Energy AI system.

Receding-Horizon MPC Concept
-----------------------------
At every control step (default: every 60 minutes) the MPC controller:
  1. Observes the current station state (SOC, fuel, temperatures, …).
  2. Generates a 24-hour look-ahead forecast for solar irradiance, wind
     power, and electrical demand using a physics-inspired sinusoidal model
     calibrated to the current hour-of-day, season, and temperature.
  3. Solves the 24-hour LP via MILPOptimizer to obtain the globally
     optimal dispatch sequence.
  4. Applies only the **first hour's commands** to the station hardware.
  5. Discards the rest of the plan and repeats next hour with updated
     measurements ("receding horizon").

Why receding horizon matters for polar stations
-----------------------------------------------
• Arctic/Antarctic weather changes rapidly – blizzards can cut solar and
  wind to zero within minutes.  Re-solving every hour integrates new sensor
  data before committing to long-range commands.
• Battery thermal behaviour changes with ambient temperature; a fresh solve
  captures the latest derated capacity.
• Fuel tank levels decrease; the optimizer naturally extends fuel reserves
  as the horizon moves forward.
• Load profiles shift with science schedules; new demand measurements
  correct the forecast bias.

Usage
-----
  from app.optimization.mpc_controller import MPCController
  ctrl = MPCController()
  plan = ctrl.run_mpc_step(station="Maitri", current_state={...})
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

import numpy as np

from app.optimization.milp_optimizer import MILPOptimizer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Synthetic forecast parameters (polar-calibrated sinusoidal model)
# ---------------------------------------------------------------------------
# These constants approximate typical Indian polar station (Maitri/Bharati)
# energy profiles.  A trained ML model should replace these for production.
_SOLAR_PEAK_KW_SUMMER  = 120.0   # kW at peak summer irradiance
_SOLAR_PEAK_KW_WINTER  = 0.0     # polar night – no solar
_WIND_BASE_KW          = 40.0    # base wind generation (kW)
_WIND_AMPLITUDE_KW     = 30.0    # diurnal swing amplitude
_DEMAND_BASE_KW        = 180.0   # station base load (kW)
_DEMAND_PEAK_KW        = 250.0   # daytime peak (labs + heating)
_NOISE_STD_FRACTION    = 0.05    # 5 % Gaussian noise on all forecasts


class MPCController:
    """
    Model Predictive Control orchestrator for polar research station energy.

    Wraps :class:`~app.optimization.milp_optimizer.MILPOptimizer` in a
    receding-horizon loop.  Forecast generation is done inline using a
    physics-inspired sinusoidal model so the controller works without a
    pre-trained ML model.

    Attributes
    ----------
    optimizer : MILPOptimizer
        The LP solver used for each MPC step.
    replan_interval_minutes : int
        How often the MPC loop should replan (default 60 minutes).
    """

    def __init__(self, replan_interval_minutes: int = 60) -> None:
        self.optimizer = MILPOptimizer()
        self.replan_interval_minutes = replan_interval_minutes

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_mpc_step(
        self,
        station: str,
        current_state: dict[str, Any],
        horizon_hours: int = 24,
    ) -> dict[str, Any]:
        """
        Execute one MPC step: forecast → optimise → extract current commands.

        Parameters
        ----------
        station : str
            Station identifier (e.g. ``"Maitri"`` or ``"Bharati"``).
        current_state : dict
            Must contain at minimum:
              - ``hour_of_day``    (int, 0-23)
              - ``day_of_year``    (int, 1-365)
              - ``temperature_c``  (float)
              - ``battery_soc_init`` (float, 0-100)
              - ``battery_capacity_kwh`` (float)
              - ``fuel_level_pct`` (float)
              - ``fuel_tank_liters`` (float)
              - ``genset_rated_kw`` (float)
        horizon_hours : int
            Look-ahead window.  Must be 24 for the current LP formulation.

        Returns
        -------
        dict
            Full 24-hour optimised plan **plus** MPC metadata and
            ``current_step_commands`` (the hour-0 actions to execute now).
        """
        horizon_hours = 24  # LP is always 24h; clamp regardless of input

        # ---- 1. Generate synthetic 24-hour forecasts ---------------------
        forecasts = self._generate_forecasts(current_state, horizon_hours)

        # ---- 2. Merge forecasts into state dict for optimizer ------------
        opt_state = {**current_state, **forecasts}

        # ---- 3. Solve LP via MILPOptimizer --------------------------------
        plan = self.optimizer.solve_24h_plan(opt_state)

        # ---- 4. Extract hour-0 commands (execute RIGHT NOW) ---------------
        current_commands: dict[str, Any] = {}
        if plan["hourly_schedule"]:
            h0 = plan["hourly_schedule"][0]
            current_commands = {
                "diesel_setpoint_kw":          h0["diesel_kw"],
                "battery_charge_setpoint_kw":  h0["battery_charge_kw"],
                "battery_discharge_setpoint_kw": h0["battery_discharge_kw"],
                "load_shed_kw":                h0["load_shed_kw"],
                "expected_soc_after_hour_pct": h0["soc_pct"],
                "action_timestamp":            h0["timestamp"],
            }

        # ---- 5. Attach MPC metadata ---------------------------------------
        plan["mpc_metadata"] = {
            "station":                  station,
            "horizon_hours":            horizon_hours,
            "optimization_timestamp":   datetime.now(tz=timezone.utc).isoformat(),
            "next_replan_in_minutes":   self.replan_interval_minutes,
            "forecast_model":           "synthetic_sinusoidal_v1",
            "forecasts_used":           forecasts,
        }
        plan["current_step_commands"] = current_commands

        return plan

    def get_rolling_schedule(
        self,
        station: str,
        current_state: dict[str, Any],
        horizon_hours: int = 24,
    ) -> dict[str, Any]:
        """
        Return a full rolling-horizon schedule with an educational explanation.

        Identical to :meth:`run_mpc_step` but appends a
        ``rolling_horizon_explanation`` field explaining the receding-horizon
        concept to non-expert operators.

        Parameters
        ----------
        station : str
            Station identifier.
        current_state : dict
            See :meth:`run_mpc_step`.
        horizon_hours : int
            Planning window (always clamped to 24).

        Returns
        -------
        dict
            Output of :meth:`run_mpc_step` plus ``rolling_horizon_explanation``.
        """
        plan = self.run_mpc_step(station, current_state, horizon_hours)

        plan["rolling_horizon_explanation"] = (
            "Receding-Horizon MPC: At each control step (every "
            f"{self.replan_interval_minutes} minutes) the system solves a "
            f"{horizon_hours}-hour optimisation problem, applies only the first "
            "hour's commands to the station hardware, then shifts the planning "
            "window forward and re-solves with fresh sensor measurements. "
            "This approach is critical for polar stations because (1) Arctic/"
            "Antarctic weather (blizzards, polar vortex) can change rapidly, "
            "invalidating long-range plans; (2) battery thermal capacity changes "
            "with ambient temperature and must be updated every cycle; "
            "(3) science crew schedules introduce sudden load steps; and "
            "(4) fuel consumption must be tracked in real time to avoid running "
            "out during the long resupply gaps (months) typical of Antarctic "
            "operations.  The receding horizon guarantees the optimizer always "
            "uses the latest available information while still accounting for "
            "future constraints (e.g., avoiding deep discharge before a forecast "
            "cloudy period with no solar)."
        )
        return plan

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _generate_forecasts(
        self, current_state: dict[str, Any], horizon_hours: int
    ) -> dict[str, list[float]]:
        """
        Generate synthetic 24-hour forecasts using a sinusoidal model.

        The model is calibrated to polar conditions:
        - Solar: zero during polar night (winter), sinusoidal daytime peak
          in summer.  Polar stations experience 24-hour sunlight in summer
          (midnight sun) – modelled as a flattened, low-amplitude sine.
        - Wind: base load plus diurnal variation (katabatic winds peak in
          early morning at polar stations).
        - Demand: peaks during working hours (lab instruments, galley); the
          base load includes life-support heating which is near-constant.

        Parameters
        ----------
        current_state : dict
            Must have ``hour_of_day``, ``day_of_year``, ``temperature_c``.
        horizon_hours : int
            Number of forecast hours (24).

        Returns
        -------
        dict
            Keys: ``solar_forecast``, ``wind_forecast``, ``demand_forecast``.
        """
        h0  = int(current_state.get("hour_of_day", datetime.now().hour))
        doy = int(current_state.get("day_of_year", datetime.now().timetuple().tm_yday))
        temp_c = float(current_state.get("temperature_c", -15.0))

        # ---- Season factor (0=polar night, 1=midnight sun) ---------------
        # Southern hemisphere: summer Dec-Feb (doy ~335 or ~1-60)
        # Approximate with cosine centred on Jan 1 (doy 1 / 365):
        season_angle = 2 * math.pi * (doy - 1) / 365.0
        season_summer_factor = max(0.0, math.cos(season_angle))  # 1.0 in Jan, 0 in Jul

        rng = np.random.default_rng(seed=doy * 100 + h0)  # reproducible per hour

        solar_fc  = []
        wind_fc   = []
        demand_fc = []

        for i in range(horizon_hours):
            hour = (h0 + i) % 24

            # --- Solar (kW) -----------------------------------------------
            # Southern polar summer: low elevation sun throughout the day.
            # Model as scaled cosine (peak at solar noon ≈ hour 12).
            # During polar night (winter) output is zero.
            solar_angle = math.cos(math.pi * (hour - 12) / 12.0)
            solar_base  = (
                _SOLAR_PEAK_KW_SUMMER
                * max(0.0, solar_angle)
                * season_summer_factor
            )
            # Temperature effect: panels are slightly more efficient when cold
            temp_solar_boost = 1.0 + max(0.0, (25.0 - temp_c) * 0.004)
            solar_val = solar_base * temp_solar_boost
            solar_noise = rng.normal(0, solar_val * _NOISE_STD_FRACTION) if solar_val > 0 else 0
            solar_fc.append(max(0.0, solar_val + solar_noise))

            # --- Wind (kW) ------------------------------------------------
            # Katabatic winds at Antarctic stations are strongest in early
            # morning (0200-0600 local).  Model as inverted cosine peak.
            wind_angle  = math.cos(math.pi * (hour - 3) / 12.0)  # peak at 03:00
            wind_val    = _WIND_BASE_KW + _WIND_AMPLITUDE_KW * max(0.0, wind_angle)
            # Cold dense air → slightly higher wind energy density in winter
            cold_boost  = 1.0 + max(0.0, (-temp_c) * 0.003)
            wind_val   *= cold_boost
            wind_noise  = rng.normal(0, wind_val * _NOISE_STD_FRACTION)
            wind_fc.append(max(0.0, wind_val + wind_noise))

            # --- Demand (kW) ----------------------------------------------
            # Base: life-support heating (constant, higher in colder temps)
            # Peak: lab instruments and galley (0700-1800)
            heating_load = max(0.0, 50.0 + (-temp_c) * 1.5)  # more heating when colder
            lab_angle = math.cos(math.pi * (hour - 12) / 9.0) if 7 <= hour <= 18 else -1
            lab_load  = max(0.0, 70.0 * max(0.0, lab_angle)) if 7 <= hour <= 18 else 0.0
            demand_val = _DEMAND_BASE_KW + heating_load + lab_load
            demand_noise = rng.normal(0, demand_val * _NOISE_STD_FRACTION)
            demand_fc.append(max(50.0, demand_val + demand_noise))  # floor at 50 kW

        return {
            "solar_forecast":  [round(v, 2) for v in solar_fc],
            "wind_forecast":   [round(v, 2) for v in wind_fc],
            "demand_forecast": [round(v, 2) for v in demand_fc],
        }
