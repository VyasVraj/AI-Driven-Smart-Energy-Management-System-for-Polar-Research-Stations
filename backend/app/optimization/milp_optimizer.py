"""
milp_optimizer.py
=================
Linear-Program (LP) based 24-hour energy dispatch optimizer for polar research
stations.  Although named "MILP" for the system architecture, scipy.optimize.
linprog only supports continuous LP.  Binary ON/OFF decisions for the genset
are therefore handled via a **post-processing heuristic** that enforces the
40 % minimum-load rule after the LP solve (continuous relaxation → rounding).

Dispatch variables per hour t (0-23)
--------------------------------------
  diesel[t]          – diesel genset output (kW)
  batt_charge[t]     – battery charging power (kW)
  batt_discharge[t]  – battery discharging power (kW)
  load_shed[t]       – involuntary load curtailment (kW)

Objective (minimise)
---------------------
  Σ_t [  fuel_cost_per_kwh * diesel[t]
       + battery_wear_cost * (batt_charge[t] + batt_discharge[t])
       + load_shed_penalty * load_shed[t]  ]

Constraints
-----------
  1. Energy balance (equality):
       solar[t] + wind[t] + diesel[t] + batt_discharge[t]
       - batt_charge[t] - load_shed[t]  =  demand[t]
  2. SOC dynamics (equality):
       soc[t+1] = soc[t] + eta_c * batt_charge[t] - (1/eta_d) * batt_discharge[t]
       (units: kWh; soc[0] = battery_capacity_kwh * battery_soc_init/100)
  3. SOC bounds: soc_min <= soc[t] <= soc_max  (20 %–90 % of effective capacity)
  4. Variable bounds: all >= 0, diesel <= genset_rated_kw,
       batt_charge/discharge <= rated C-rate
  5. Post-processing: if diesel[t] < 40 % * genset_rated_kw  → set to 0
     (OFF), redistributing deficit to battery discharge / load-shed to
     maintain balance.

Usage
-----
  from app.optimization.milp_optimizer import MILPOptimizer
  optimizer = MILPOptimizer()
  plan = optimizer.solve_24h_plan(state)
"""

from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

try:
    from scipy.optimize import linprog
    _SCIPY_OK = True
except (ImportError, Exception):
    _SCIPY_OK = False
    linprog = None
    logger.warning("scipy.optimize.linprog unavailable, MILPOptimizer will use greedy heuristic")


logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Physical & economic constants
# ---------------------------------------------------------------------------
FUEL_LITERS_PER_KWH: float = 0.25          # diesel specific consumption (L/kWh)
CO2_KG_PER_LITER: float = 2.68             # diesel CO2 emission factor
BATTERY_WEAR_COST: float = 0.001           # $/kWh of throughput (relative)
LOAD_SHED_PENALTY: float = 1_000.0         # huge penalty – shed only as last resort
GENSET_MIN_LOAD_FRACTION: float = 0.40     # genset must run ≥ 40 % rated if ON
CHARGE_EFFICIENCY: float = 0.95            # round-trip charging efficiency η_c
DISCHARGE_EFFICIENCY: float = 0.95        # round-trip discharging efficiency η_d
SOC_MIN_FRACTION: float = 0.20            # lower SOC limit (polar safety margin)
SOC_MAX_FRACTION: float = 0.90            # upper SOC limit (avoid overcharge)
BATTERY_C_RATE: float = 0.5               # max charge/discharge rate (C) = 0.5 C

# Baseline scenario: all demand met by diesel (used for savings calculation)
BASELINE_DIESEL_FRACTION: float = 1.0


class MILPOptimizer:
    """
    24-hour LP energy dispatch optimizer for polar research stations.

    The class wraps ``scipy.optimize.linprog`` to solve a continuous relaxation
    of the mixed-integer program.  Post-processing enforces discrete constraints
    such as the genset minimum-load rule.  If the LP is infeasible, a greedy
    fallback planner ensures the station always gets *some* schedule.

    Parameters
    ----------
    fuel_cost_per_kwh : float
        Economic cost coefficient for diesel generation (default 0.25 L/kWh).
    battery_wear_cost : float
        Cost coefficient per kWh of battery throughput.
    load_shed_penalty : float
        Penalty per kWh of unmet demand (must dominate other costs).
    """

    def __init__(
        self,
        fuel_cost_per_kwh: float = FUEL_LITERS_PER_KWH,
        battery_wear_cost: float = BATTERY_WEAR_COST,
        load_shed_penalty: float = LOAD_SHED_PENALTY,
    ) -> None:
        self.fuel_cost_per_kwh = fuel_cost_per_kwh
        self.battery_wear_cost = battery_wear_cost
        self.load_shed_penalty = load_shed_penalty

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def solve_24h_plan(self, state: dict[str, Any]) -> dict[str, Any]:
        """
        Solve the 24-hour energy dispatch optimisation problem.

        Parameters
        ----------
        state : dict
            Expected keys
            ~~~~~~~~~~~~~~
            solar_forecast       : list[float]  – 24 hourly solar values (kW)
            wind_forecast        : list[float]  – 24 hourly wind values  (kW)
            demand_forecast      : list[float]  – 24 hourly demand values (kW)
            battery_soc_init     : float        – initial battery SOC (0–100 %)
            battery_capacity_kwh : float        – usable battery capacity (kWh)
            fuel_level_pct       : float        – current fuel tank level (%)
            fuel_tank_liters     : float        – tank volume (L)
            temperature_c        : float        – ambient temperature (°C)
            genset_rated_kw      : float        – diesel genset rated power (kW)

        Returns
        -------
        dict
            Comprehensive 24-hour schedule and summary metrics. See module
            docstring for full key listing.
        """
        # ---- 1. Extract & validate inputs ---------------------------------
        try:
            solar    = np.array(state["solar_forecast"],  dtype=float)
            wind     = np.array(state["wind_forecast"],   dtype=float)
            demand   = np.array(state["demand_forecast"], dtype=float)
            soc_init_pct       = float(state["battery_soc_init"])
            batt_cap_kwh       = float(state["battery_capacity_kwh"])
            fuel_level_pct     = float(state.get("fuel_level_pct", 80.0))
            fuel_tank_liters   = float(state.get("fuel_tank_liters", 5000.0))
            temp_c             = float(state.get("temperature_c", -10.0))
            genset_rated_kw    = float(state.get("genset_rated_kw", 150.0))
        except (KeyError, TypeError, ValueError) as exc:
            logger.error("MILPOptimizer: invalid state dict – %s", exc)
            return self._error_result(str(exc))

        # Clamp renewable forecasts to non-negative
        solar  = np.clip(solar,  0, None)
        wind   = np.clip(wind,   0, None)
        demand = np.clip(demand, 1, None)   # at least 1 kW to avoid trivial LP

        T = 24  # planning horizon (hours)
        if len(solar) != T or len(wind) != T or len(demand) != T:
            return self._error_result("Forecasts must contain exactly 24 values.")

        # ---- 2. Derive battery limits from temperature --------------------
        # In polar conditions the battery capacity is thermally derated.
        # The full thermal model lives in battery_thermal_model.py; here we
        # apply a simple rule-of-thumb so the LP remains self-contained.
        temp_derate = self._temperature_capacity_factor(temp_c)
        eff_batt_cap  = batt_cap_kwh * temp_derate            # effective kWh
        soc_min_kwh   = eff_batt_cap * SOC_MIN_FRACTION       # 20 % lower bound
        soc_max_kwh   = eff_batt_cap * SOC_MAX_FRACTION       # 90 % upper bound
        max_charge_kw = eff_batt_cap * BATTERY_C_RATE         # 0.5 C charge limit
        max_disch_kw  = eff_batt_cap * BATTERY_C_RATE         # 0.5 C discharge limit
        soc0_kwh      = eff_batt_cap * (soc_init_pct / 100.0)
        soc0_kwh      = np.clip(soc0_kwh, soc_min_kwh, soc_max_kwh)

        # Cannot charge below 0 °C (lithium plating risk in polar environment)
        if temp_c < 0:
            max_charge_kw = 0.0
            logger.warning(
                "MILPOptimizer: temp %.1f°C < 0°C → battery charging disabled.", temp_c
            )

        # ---- 3. Build LP matrices -----------------------------------------
        # Decision vector x of length 4*T:
        #   x[0*T : 1*T]  → diesel[t]          (kW)
        #   x[1*T : 2*T]  → batt_charge[t]     (kW)
        #   x[2*T : 3*T]  → batt_discharge[t]  (kW)
        #   x[3*T : 4*T]  → load_shed[t]       (kW)
        n = 4 * T

        # Objective coefficients
        c_obj = np.zeros(n)
        c_obj[0*T : 1*T] = self.fuel_cost_per_kwh      # diesel cost
        c_obj[1*T : 2*T] = self.battery_wear_cost       # charge wear
        c_obj[2*T : 3*T] = self.battery_wear_cost       # discharge wear
        c_obj[3*T : 4*T] = self.load_shed_penalty       # unmet demand penalty

        # Bounds: [0, upper] for all variables
        bounds = (
            [(0, genset_rated_kw)] * T    +  # diesel
            [(0, max_charge_kw)]   * T    +  # batt_charge
            [(0, max_disch_kw)]    * T    +  # batt_discharge
            [(0, None)]            * T       # load_shed (uncapped)
        )

        # Equality constraints: A_eq @ x = b_eq
        # (a) Energy balance (T equations)
        # (b) SOC dynamics (T equations, using soc as implicit state)
        #     Re-formulated as a cumulative sum constraint on soc[t+1]
        #     to stay within linprog's A_eq / b_eq paradigm.

        n_eq = T + T   # T balance + T soc-dynamics
        A_eq = np.zeros((n_eq, n))
        b_eq = np.zeros(n_eq)

        for t in range(T):
            # (a) Energy balance: diesel + batt_discharge - batt_charge - load_shed
            #                     = demand - solar - wind
            row = t
            A_eq[row, 0*T + t] =  1   # diesel
            A_eq[row, 1*T + t] = -1   # batt_charge (consumed from grid side)
            A_eq[row, 2*T + t] =  1   # batt_discharge (injected to grid)
            A_eq[row, 3*T + t] = -1   # load_shed (reduces effective demand)
            b_eq[row] = demand[t] - solar[t] - wind[t]

        # SOC dynamics: soc[t] = soc0 + Σ_{τ=0}^{t-1}(η_c*charge[τ] - (1/η_d)*disch[τ])
        # soc[t] == soc0 + Σ … → written as: Σ(η_c*charge - (1/η_d)*disch) = soc[t] - soc0
        # We enforce soc bounds via variable bounds on a slack soc vector; for the
        # equality formulation we add one SOC balance row per hour t (1-indexed):
        #   η_c * Σcharge[0..t] - (1/η_d) * Σdisch[0..t] = soc[t+1] - soc0
        # But since we don't have soc as a free variable here, we enforce SOC
        # bounds as *inequality* constraints (A_ub) below instead.

        # Remove the T SOC equality rows – replace with inequality bounds
        A_eq = A_eq[:T]       # keep only energy balance
        b_eq = b_eq[:T]

        # Inequality constraints: A_ub @ x <= b_ub  (SOC bounds)
        # soc[t] = soc0 + Σ_{τ<t}(η_c*charge[τ] - disch[τ]/η_d)
        # soc[t] <= soc_max  →  Σ(η_c*charge - disch/η_d) <= soc_max - soc0
        # soc[t] >= soc_min  → -Σ(η_c*charge - disch/η_d) <= -(soc_min - soc0) = soc0 - soc_min

        n_ub = 2 * T
        A_ub = np.zeros((n_ub, n))
        b_ub = np.zeros(n_ub)

        cumulative_charge_coeff = np.zeros(T)
        cumulative_disch_coeff  = np.zeros(T)

        for t in range(T):
            # After step t the SOC is soc0 + Σ_{τ=0}^{t}(...)
            cumulative_charge_coeff[t] =  CHARGE_EFFICIENCY
            cumulative_disch_coeff[t]  = -1.0 / DISCHARGE_EFFICIENCY

            # SOC upper bound rows
            row_hi = t
            for τ in range(t + 1):
                A_ub[row_hi, 1*T + τ] =  CHARGE_EFFICIENCY       # + charge
                A_ub[row_hi, 2*T + τ] = -1.0 / DISCHARGE_EFFICIENCY  # - discharge
            b_ub[row_hi] = soc_max_kwh - soc0_kwh

            # SOC lower bound rows (flipped sign)
            row_lo = T + t
            for τ in range(t + 1):
                A_ub[row_lo, 1*T + τ] = -CHARGE_EFFICIENCY
                A_ub[row_lo, 2*T + τ] =  1.0 / DISCHARGE_EFFICIENCY
            b_ub[row_lo] = soc0_kwh - soc_min_kwh

        # ---- 4. Solve LP --------------------------------------------------
        if linprog is None:
            solver_ok = False
            solver_status = "unavailable"
            solver_message = "scipy.optimize.linprog not available"
            result = None
        else:
            try:
                result = linprog(
                    c_obj,
                    A_ub=A_ub,
                    b_ub=b_ub,
                    A_eq=A_eq,
                    b_eq=b_eq,
                    bounds=bounds,
                    method="highs",
                    options={"disp": False, "time_limit": 30.0},
                )
                solver_ok = result.status == 0
                solver_status  = "optimal" if solver_ok else _LP_STATUS.get(result.status, "unknown")
                solver_message = result.message
            except Exception as exc:
                logger.error("MILPOptimizer: linprog raised – %s", exc)
                solver_ok      = False
                solver_status  = "error"
                solver_message = str(exc)
                result         = None

        # ---- 5. Extract solution or fall back ----------------------------
        if solver_ok and result is not None:
            x = result.x
            diesel_kw  = np.clip(x[0*T : 1*T], 0, genset_rated_kw)
            charge_kw  = np.clip(x[1*T : 2*T], 0, max_charge_kw)
            disch_kw   = np.clip(x[2*T : 3*T], 0, max_disch_kw)
            shed_kw    = np.clip(x[3*T : 4*T], 0, None)
        else:
            logger.warning("MILPOptimizer: LP infeasible/error – using greedy fallback.")
            diesel_kw, charge_kw, disch_kw, shed_kw = self._greedy_fallback(
                solar, wind, demand, soc0_kwh, eff_batt_cap,
                soc_min_kwh, soc_max_kwh, max_charge_kw, max_disch_kw,
                genset_rated_kw,
            )
            solver_status  = "fallback_greedy"
            solver_message = "LP infeasible; greedy heuristic used."

        # ---- 6. Post-processing: enforce genset min-load rule ------------
        #  If diesel[t] > 0 but < 40 % rated, either bump to min-load OR turn off.
        #  Strategy: turn off if renewable + battery can cover the shortfall.
        min_genset_kw = GENSET_MIN_LOAD_FRACTION * genset_rated_kw
        for t in range(T):
            if 0 < diesel_kw[t] < min_genset_kw:
                shortfall = min_genset_kw - diesel_kw[t]
                # Try to cover shortfall from battery discharge
                extra_disch = min(shortfall, max_disch_kw - disch_kw[t])
                if extra_disch >= shortfall:
                    # Turn genset off, cover with battery
                    disch_kw[t]  += diesel_kw[t]
                    diesel_kw[t]  = 0.0
                else:
                    # Ramp genset up to minimum load
                    diesel_kw[t] = min_genset_kw

        # ---- 7. Reconstruct SOC trajectory --------------------------------
        soc = np.zeros(T + 1)
        soc[0] = soc0_kwh
        for t in range(T):
            soc[t + 1] = (
                soc[t]
                + CHARGE_EFFICIENCY * charge_kw[t]
                - (1.0 / DISCHARGE_EFFICIENCY) * disch_kw[t]
            )
            soc[t + 1] = np.clip(soc[t + 1], 0, eff_batt_cap)

        # ---- 8. Build hourly schedule ------------------------------------
        now_utc = datetime.now(tz=timezone.utc).replace(minute=0, second=0, microsecond=0)
        hourly_schedule = []
        for t in range(T):
            ts = (now_utc + timedelta(hours=t)).isoformat()
            soc_pct = (soc[t] / eff_batt_cap) * 100.0 if eff_batt_cap > 0 else 0.0
            hourly_schedule.append(
                {
                    "timestamp":             ts,
                    "hour":                  t,
                    "diesel_kw":             round(float(diesel_kw[t]),  2),
                    "solar_kw":              round(float(solar[t]),       2),
                    "wind_kw":               round(float(wind[t]),        2),
                    "battery_discharge_kw":  round(float(disch_kw[t]),   2),
                    "battery_charge_kw":     round(float(charge_kw[t]),  2),
                    "soc_pct":               round(float(soc_pct),        2),
                    "load_shed_kw":          round(float(shed_kw[t]),    2),
                }
            )

        # ---- 9. Summary metrics ------------------------------------------
        total_diesel_kwh    = float(np.sum(diesel_kw))
        total_fuel_liters   = total_diesel_kwh * FUEL_LITERS_PER_KWH
        total_co2_kg        = total_fuel_liters * CO2_KG_PER_LITER
        total_renewable_kwh = float(np.sum(solar + wind))
        total_demand_kwh    = float(np.sum(demand))
        renewable_fraction  = (
            total_renewable_kwh / total_demand_kwh * 100.0 if total_demand_kwh > 0 else 0.0
        )
        soc_pct_arr = np.array(
            [(s / eff_batt_cap) * 100.0 for s in soc[:-1]]
        ) if eff_batt_cap > 0 else np.zeros(T)

        diesel_runtime_hours      = int(np.sum(diesel_kw > 1.0))
        batt_throughput_kwh       = float(np.sum(charge_kw + disch_kw))
        battery_cycles_equivalent = batt_throughput_kwh / (2.0 * batt_cap_kwh) if batt_cap_kwh > 0 else 0.0

        # Baseline: 100 % diesel for entire demand
        baseline_fuel_liters = total_demand_kwh * FUEL_LITERS_PER_KWH
        baseline_co2_kg      = baseline_fuel_liters * CO2_KG_PER_LITER
        fuel_savings          = max(0.0, baseline_fuel_liters - total_fuel_liters)
        co2_savings           = max(0.0, baseline_co2_kg      - total_co2_kg)

        return {
            "hourly_schedule":                 hourly_schedule,
            "total_fuel_liters":               round(total_fuel_liters,   2),
            "total_co2_kg":                    round(total_co2_kg,        2),
            "total_diesel_kwh":                round(total_diesel_kwh,    2),
            "renewable_fraction_pct":          round(renewable_fraction,  2),
            "peak_soc_pct":                    round(float(np.max(soc_pct_arr)), 2),
            "min_soc_pct":                     round(float(np.min(soc_pct_arr)), 2),
            "diesel_runtime_hours":            diesel_runtime_hours,
            "battery_cycles_equivalent":       round(battery_cycles_equivalent, 4),
            "fuel_savings_vs_baseline_liters": round(fuel_savings,  2),
            "co2_savings_vs_baseline_kg":      round(co2_savings,   2),
            "solver_status":                   solver_status,
            "solver_message":                  solver_message,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _temperature_capacity_factor(temp_c: float) -> float:
        """
        Return a simple capacity derating factor for the battery based on
        ambient temperature, consistent with the full TEMP_CAPACITY_TABLE
        in BatteryThermalModel.  Uses linear interpolation between known points.
        """
        table = {25: 1.0, 0: 0.88, -10: 0.78, -20: 0.65, -30: 0.52, -40: 0.38}
        temps  = sorted(table.keys())
        factors = [table[t] for t in temps]
        return float(np.interp(temp_c, temps, factors))

    @staticmethod
    def _greedy_fallback(
        solar: np.ndarray,
        wind: np.ndarray,
        demand: np.ndarray,
        soc0_kwh: float,
        eff_batt_cap: float,
        soc_min_kwh: float,
        soc_max_kwh: float,
        max_charge_kw: float,
        max_disch_kw: float,
        genset_rated_kw: float,
    ):
        """
        Greedy fallback scheduler used when LP is infeasible.

        Priority order each hour:
        1. Serve demand with renewable (solar + wind).
        2. Serve residual from battery discharge.
        3. Serve remaining residual from diesel.
        4. Charge battery with any surplus renewable.
        5. Shed any unresolvable deficit.
        """
        T = 24
        diesel_kw = np.zeros(T)
        charge_kw = np.zeros(T)
        disch_kw  = np.zeros(T)
        shed_kw   = np.zeros(T)
        soc = soc0_kwh

        for t in range(T):
            renew = solar[t] + wind[t]
            residual = demand[t] - renew

            if residual <= 0:
                # Surplus renewable → try to charge battery
                surplus   = -residual
                charge    = min(surplus, max_charge_kw, soc_max_kwh - soc)
                charge    = max(charge, 0.0)
                charge_kw[t] = charge
                soc       += CHARGE_EFFICIENCY * charge
            else:
                # Discharge battery first
                avail_disch = min(max_disch_kw, max(0.0, soc - soc_min_kwh))
                batt_out    = min(residual, avail_disch)
                disch_kw[t] = batt_out
                soc        -= batt_out / DISCHARGE_EFFICIENCY
                residual   -= batt_out

                # Then diesel
                diesel = min(residual, genset_rated_kw)
                diesel_kw[t] = diesel
                residual    -= diesel

                # Whatever remains is involuntary load shed
                shed_kw[t] = max(0.0, residual)

            soc = np.clip(soc, 0, eff_batt_cap)

        return diesel_kw, charge_kw, disch_kw, shed_kw

    @staticmethod
    def _error_result(msg: str) -> dict[str, Any]:
        """Return a structured error result dict when optimisation cannot proceed."""
        return {
            "hourly_schedule":                 [],
            "total_fuel_liters":               0.0,
            "total_co2_kg":                    0.0,
            "total_diesel_kwh":                0.0,
            "renewable_fraction_pct":          0.0,
            "peak_soc_pct":                    0.0,
            "min_soc_pct":                     0.0,
            "diesel_runtime_hours":            0,
            "battery_cycles_equivalent":       0.0,
            "fuel_savings_vs_baseline_liters": 0.0,
            "co2_savings_vs_baseline_kg":      0.0,
            "solver_status":                   "error",
            "solver_message":                  msg,
        }


# Mapping from linprog status codes to human-readable strings
_LP_STATUS: dict[int, str] = {
    0: "optimal",
    1: "iteration_limit",
    2: "infeasible",
    3: "unbounded",
    4: "numerical_difficulties",
}
