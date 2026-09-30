"""
battery_thermal_model.py
========================
Physics-based thermal degradation and derating model for lithium-ion battery
packs deployed at polar research stations.

Background
----------
Lithium-ion cells suffer significant capacity and power losses at sub-zero
temperatures due to:
  1. Increased electrolyte viscosity → slower ion transport → higher internal
     resistance → reduced usable capacity and peak current.
  2. Lithium plating on the graphite anode during charging at T < 0 °C – a
     permanent, irreversible form of capacity fade that can also cause internal
     short circuits (safety hazard).
  3. Electrode mechanical stress from thermal expansion/contraction cycles
     (polar stations see Δ70 °C seasonal swings) accelerates cracking.

This model captures items 1 and 2 via lookup tables derived from published
battery datasheets at low temperatures, plus a linear interpolation helper.
Item 3 (calendar ageing) is not modelled here; it is handled by the ML
degradation predictor.

Key design decisions
--------------------
• Lookup tables instead of electrochemical equations – avoids the need for
  cell-level parameters that are rarely published.
• Conservative (pessimistic) capacity factors – safety is paramount when the
  nearest repair depot may be thousands of kilometres away.
• The heating-blanket parasitic load (3.5 kW) is accounted for so that the
  MILP optimizer can include it in the demand forecast.

Usage
-----
  from app.ml.battery_thermal_model import BatteryThermalModel
  model = BatteryThermalModel()
  print(model.full_assessment(temp_c=-25, nominal_kwh=500, nominal_charge_kw=125, soc_pct=60))
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

# ---------------------------------------------------------------------------
# Physical constants
# ---------------------------------------------------------------------------

# Temperature (°C) at or below which charging is completely prohibited to
# prevent lithium plating on the graphite anode.
TEMP_CHARGE_CUTOFF: float = 0.0

# Battery heating blanket continuous power draw (kW).
# Polar battery enclosures use resistive heating mats to keep cells warm.
HEATING_BLANKET_POWER_KW: float = 3.5

# Operational temperature range (°C) where no derating or heating alert fires.
OPTIMAL_TEMP_RANGE: tuple[float, float] = (-10.0, 25.0)

# Capacity derating table: temperature (°C) → usable capacity fraction (0-1)
# Source: composite of published low-temperature Li-NMC/LFP datasheets.
# Values are conservative (10th-percentile across manufacturers).
TEMP_CAPACITY_TABLE: dict[float, float] = {
    25.0:  1.00,   # rated capacity at 25 °C (reference)
     0.0:  0.88,   # 12 % loss at freezing
   -10.0:  0.78,   # 22 % loss – common Antarctic winter scenario
   -20.0:  0.65,   # 35 % loss – severe cold
   -30.0:  0.52,   # 48 % loss – extreme Antarctic conditions
   -40.0:  0.38,   # 62 % loss – absolute worst-case polar night
}

# Power derating table: temperature (°C) → max C-rate fraction (0-1)
# Both charge and discharge rates are derated at low temperatures because
# the high internal resistance causes excessive voltage drops.
TEMP_POWER_DERATING_TABLE: dict[float, float] = {
    25.0:  1.00,
     0.0:  0.80,   # allow 80 % of rated C-rate at 0 °C
   -10.0:  0.65,
   -20.0:  0.50,
   -30.0:  0.35,
   -40.0:  0.20,
}


class BatteryThermalModel:
    """
    Polar-environment lithium-ion battery thermal performance model.

    Provides capacity derating, charge-rate derating, heating load
    calculation, and full thermal health assessments for use by the
    MILP optimizer and MPC controller.
    """

    # ------------------------------------------------------------------ #
    # Pre-computed sorted arrays for interpolation (built once at init)   #
    # ------------------------------------------------------------------ #
    def __init__(self) -> None:
        cap_temps   = sorted(TEMP_CAPACITY_TABLE.keys())
        self._cap_temps    = np.array(cap_temps, dtype=float)
        self._cap_factors  = np.array([TEMP_CAPACITY_TABLE[t]   for t in cap_temps], dtype=float)

        pwr_temps   = sorted(TEMP_POWER_DERATING_TABLE.keys())
        self._pwr_temps    = np.array(pwr_temps, dtype=float)
        self._pwr_factors  = np.array([TEMP_POWER_DERATING_TABLE[t] for t in pwr_temps], dtype=float)

    # ------------------------------------------------------------------ #
    # Public methods                                                       #
    # ------------------------------------------------------------------ #

    def get_effective_capacity(self, nominal_kwh: float, temp_c: float) -> float:
        """
        Return the thermally derated usable battery capacity.

        Parameters
        ----------
        nominal_kwh : float
            Nameplate capacity of the battery pack at 25 °C (kWh).
        temp_c : float
            Current ambient / enclosure temperature (°C).

        Returns
        -------
        float
            Effective usable capacity in kWh, clamped to [0, nominal_kwh].

        Notes
        -----
        Extrapolation beyond −40 °C clamps to the −40 °C factor (0.38)
        rather than extrapolating, because sub-−40 °C performance data is
        unreliable and we want a safe lower bound.
        """
        factor = float(np.interp(temp_c, self._cap_temps, self._cap_factors))
        factor = float(np.clip(factor, 0.0, 1.0))
        return round(nominal_kwh * factor, 3)

    def get_max_charge_rate(self, nominal_kw: float, temp_c: float) -> float:
        """
        Return the maximum safe battery charge power at the given temperature.

        Parameters
        ----------
        nominal_kw : float
            Rated maximum charge power at 25 °C (kW).
        temp_c : float
            Current temperature (°C).

        Returns
        -------
        float
            Maximum allowable charge rate in kW.  Returns **0.0** if
            temperature is at or below :data:`TEMP_CHARGE_CUTOFF` (0 °C),
            since charging below freezing risks irreversible lithium plating.
        """
        if temp_c <= TEMP_CHARGE_CUTOFF:
            return 0.0
        factor = float(np.interp(temp_c, self._pwr_temps, self._pwr_factors))
        factor = float(np.clip(factor, 0.0, 1.0))
        return round(nominal_kw * factor, 3)

    def get_max_discharge_rate(self, nominal_kw: float, temp_c: float) -> float:
        """
        Return the maximum safe battery discharge power at the given temperature.

        Unlike charging, discharging is still permitted below 0 °C but at a
        heavily derated rate (high internal resistance causes voltage sag).

        Parameters
        ----------
        nominal_kw : float
            Rated maximum discharge power at 25 °C (kW).
        temp_c : float
            Current temperature (°C).

        Returns
        -------
        float
            Maximum allowable discharge rate in kW.
        """
        factor = float(np.interp(temp_c, self._pwr_temps, self._pwr_factors))
        factor = float(np.clip(factor, 0.0, 1.0))
        return round(nominal_kw * factor, 3)

    def compute_heating_load(
        self, temp_c: float, soc_pct: float
    ) -> dict[str, Any]:
        """
        Assess the battery thermal management system load and status.

        Parameters
        ----------
        temp_c : float
            Current battery pack temperature (°C).
        soc_pct : float
            Current state-of-charge (0–100 %).

        Returns
        -------
        dict
            Keys
            ~~~~
            heating_required : bool
                True when the heating blanket must be activated.
            heating_power_kw : float
                Power consumed by the thermal management system (kW).
            heating_reason : str
                Human-readable explanation for the heating state.
            charging_allowed : bool
                Whether charging can proceed at this temperature.
            estimated_warm_up_minutes : int
                Approximate minutes to reach TEMP_CHARGE_CUTOFF (0 °C)
                at full heating blanket power, assuming a simple 1st-order
                thermal model with τ ≈ 90 min.
        """
        heating_required = temp_c < TEMP_CHARGE_CUTOFF  # below 0 °C
        charging_allowed = temp_c > TEMP_CHARGE_CUTOFF

        if not heating_required:
            heating_power_kw = 0.0
            reason = "Temperature within acceptable range; heating not required."
        else:
            heating_power_kw = HEATING_BLANKET_POWER_KW
            if temp_c < -30:
                reason = (
                    f"CRITICAL: Battery temp {temp_c:.1f}°C far below safe range. "
                    "Full heating engaged. Charging prohibited."
                )
            elif temp_c < -20:
                reason = (
                    f"WARNING: Battery temp {temp_c:.1f}°C below -20°C. "
                    "Heating engaged. Charging prohibited; discharge heavily derated."
                )
            else:
                reason = (
                    f"Battery temp {temp_c:.1f}°C below 0°C. "
                    "Heating engaged. Charging prohibited."
                )

        # Additional safety: deep discharge at extreme cold stresses cells
        if temp_c < -20 and soc_pct < 50:
            reason += (
                f" CAUTION: SOC {soc_pct:.0f}% is low at extreme temperature – "
                "limit discharge to prevent cell damage."
            )

        # Warm-up estimate: first-order thermal model
        # ΔT = temp_target - temp_c, τ ≈ 90 min for typical battery enclosure
        # t_warmup = τ * ln(ΔT / ε) ≈ simple linear approximation used here
        if heating_required:
            delta_t = TEMP_CHARGE_CUTOFF - temp_c   # °C to warm up
            # Assume heating blanket raises temperature ~1 °C per 4 minutes
            warm_up_minutes = int(math.ceil(delta_t * 4.0))
        else:
            warm_up_minutes = 0

        return {
            "heating_required":          heating_required,
            "heating_power_kw":          heating_power_kw,
            "heating_reason":            reason,
            "charging_allowed":          charging_allowed,
            "estimated_warm_up_minutes": warm_up_minutes,
        }

    def full_assessment(
        self,
        temp_c: float,
        nominal_kwh: float,
        nominal_charge_kw: float,
        soc_pct: float,
    ) -> dict[str, Any]:
        """
        Return a complete thermal health assessment of the battery pack.

        Aggregates effective capacity, derated charge/discharge rates,
        heating load, and operator recommendations into a single dict.

        Parameters
        ----------
        temp_c : float
            Current battery pack / ambient temperature (°C).
        nominal_kwh : float
            Nameplate capacity at 25 °C (kWh).
        nominal_charge_kw : float
            Rated charge power at 25 °C (kW).  Discharge is assumed equal.
        soc_pct : float
            Current state-of-charge (0–100 %).

        Returns
        -------
        dict
            Comprehensive assessment including:
            - ``effective_capacity_kwh``
            - ``capacity_derating_pct``
            - ``max_charge_kw``
            - ``max_discharge_kw``
            - ``power_derating_pct``
            - ``current_usable_energy_kwh``
            - ``heating`` (dict from :meth:`compute_heating_load`)
            - ``is_in_optimal_range`` (bool)
            - ``temperature_c``
            - ``soc_pct``
            - ``recommendations`` (list of str)
        """
        eff_cap     = self.get_effective_capacity(nominal_kwh, temp_c)
        max_chg     = self.get_max_charge_rate(nominal_charge_kw, temp_c)
        max_disch   = self.get_max_discharge_rate(nominal_charge_kw, temp_c)
        heating     = self.compute_heating_load(temp_c, soc_pct)

        cap_derating_pct = round((1.0 - eff_cap / nominal_kwh) * 100, 2) if nominal_kwh > 0 else 0.0
        pwr_factor       = float(np.interp(temp_c, self._pwr_temps, self._pwr_factors))
        pwr_derating_pct = round((1.0 - pwr_factor) * 100, 2)

        usable_energy = eff_cap * (soc_pct / 100.0)

        t_lo, t_hi = OPTIMAL_TEMP_RANGE
        is_optimal = t_lo <= temp_c <= t_hi

        # --- Build recommendation list ------------------------------------
        recommendations: list[str] = []

        if temp_c <= TEMP_CHARGE_CUTOFF:
            recommendations.append(
                "Activate battery heating blanket before attempting any charging."
            )
        if cap_derating_pct > 30:
            recommendations.append(
                f"Battery capacity derated by {cap_derating_pct:.0f}% due to cold. "
                "Consider running genset to compensate for reduced renewable storage."
            )
        if soc_pct < 25 and temp_c < -10:
            recommendations.append(
                "Low SOC combined with cold temperature: risk of cell voltage collapse. "
                "Prioritise immediate charging or reduce non-critical loads."
            )
        if temp_c < -30:
            recommendations.append(
                "Extreme temperature: verify physical battery enclosure integrity. "
                "Inspect heating blanket connections."
            )
        if heating["heating_power_kw"] > 0:
            recommendations.append(
                f"Heating blanket consuming {heating['heating_power_kw']} kW – "
                "include in demand forecast for optimizer."
            )
        if is_optimal:
            recommendations.append(
                "Battery temperature is within optimal operating range. No action needed."
            )

        return {
            "temperature_c":          temp_c,
            "soc_pct":                soc_pct,
            "nominal_capacity_kwh":   nominal_kwh,
            "effective_capacity_kwh": eff_cap,
            "capacity_derating_pct":  cap_derating_pct,
            "current_usable_energy_kwh": round(usable_energy, 3),
            "max_charge_kw":          max_chg,
            "max_discharge_kw":       max_disch,
            "power_derating_pct":     pwr_derating_pct,
            "is_in_optimal_range":    is_optimal,
            "optimal_temp_range_c":   list(OPTIMAL_TEMP_RANGE),
            "heating":                heating,
            "recommendations":        recommendations,
        }
