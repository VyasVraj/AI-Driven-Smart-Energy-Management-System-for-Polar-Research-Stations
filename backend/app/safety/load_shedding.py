"""
load_shedding.py
================
Automated 3-tier load shedding controller for polar research stations.

Overview
--------
In a polar research station, reliable power is a life-safety issue: the
nearest hospital or evacuation asset may be days away.  This module
implements a **priority-based load shedding** system that ensures life-
critical loads are NEVER interrupted while deferring non-essential loads
during power shortfalls.

Tier Hierarchy
--------------
  CRITICAL (Tier 1)   – Never shed. Loss of these loads is life-threatening.
  OPERATIONAL (Tier 2) – Shed only in genuine emergencies after Tier 3 is
                         exhausted.  Station functionality degrades but crew
                         remains safe.
  DEFERRABLE (Tier 3) – Shed first.  Science experiments, non-critical
                         computing, recreational systems.

Shedding Algorithm
------------------
  1. Compute power deficit = demand_kw - generation_kw.
  2. If deficit ≤ 0 → no shedding needed.
  3. Iterate through DEFERRABLE loads (largest first) until deficit is met.
  4. If deficit persists after all Tier-3 loads shed → iterate Tier-2.
  5. Tier-1 loads are NEVER touched.
  6. Any remaining deficit triggers a CRITICAL ALERT (e.g., genset failure).

Usage
-----
  from app.safety.load_shedding import LoadSheddingController
  ctrl = LoadSheddingController()
  plan = ctrl.get_shed_plan(power_deficit_kw=80)
  print(plan)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Enums & Data Classes
# ---------------------------------------------------------------------------


class LoadTier(IntEnum):
    """
    Priority tier for load shedding.  Lower numerical value = higher priority.

    CRITICAL (1)    – Life support, habitat heating, safety systems.
    OPERATIONAL (2) – Station operations, science base instruments.
    DEFERRABLE (3)  – Non-essential science, recreation, EV charging.
    """

    CRITICAL     = 1
    OPERATIONAL  = 2
    DEFERRABLE   = 3


@dataclass
class StationLoad:
    """
    Represents a single electrical load at a polar research station.

    Attributes
    ----------
    name : str
        Human-readable load identifier (used in shed plans and alerts).
    tier : LoadTier
        Priority tier (CRITICAL / OPERATIONAL / DEFERRABLE).
    power_kw : float
        Steady-state power consumption (kW).
    description : str
        Brief description of the load purpose.
    can_restart_remotely : bool
        Whether the load can be re-energised via SCADA without physical
        presence.  Important at polar stations where outdoor access in
        blizzard conditions is dangerous.
    """

    name: str
    tier: LoadTier
    power_kw: float
    description: str
    can_restart_remotely: bool = True


# ---------------------------------------------------------------------------
# Polar station load inventory
# ---------------------------------------------------------------------------
# Based on typical Indian polar research station (Maitri / Bharati) equipment
# lists, adjusted to illustrative power levels.  All values in kW.
# ---------------------------------------------------------------------------

POLAR_STATION_LOADS: list[StationLoad] = [
    # ---- CRITICAL (Tier 1) – NEVER shed ----------------------------------
    StationLoad(
        name="Habitat Heating",
        tier=LoadTier.CRITICAL,
        power_kw=85.0,
        description=(
            "Primary space heating for crew living quarters and corridors. "
            "Loss at -40°C means crew survival time measured in hours."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Life Support & Medical",
        tier=LoadTier.CRITICAL,
        power_kw=15.0,
        description=(
            "Medical bay equipment, oxygen concentrators, defibrillator, "
            "and life-support monitoring systems."
        ),
        can_restart_remotely=False,
    ),
    StationLoad(
        name="Emergency Lighting",
        tier=LoadTier.CRITICAL,
        power_kw=5.0,
        description=(
            "Emergency LED lighting throughout the station for safe evacuation "
            "and navigation during polar night."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Satellite Communications Terminal",
        tier=LoadTier.CRITICAL,
        power_kw=3.0,
        description=(
            "VSAT / Iridium link for emergency communication with resupply ships "
            "and mainland coordinators."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Fire Suppression System",
        tier=LoadTier.CRITICAL,
        power_kw=2.0,
        description=(
            "Fire detection, alarm, and automated suppression (CO2/halon) control "
            "panel. Fire is the single most catastrophic risk at a polar station."
        ),
        can_restart_remotely=False,
    ),
    StationLoad(
        name="Water Freeze Protection",
        tier=LoadTier.CRITICAL,
        power_kw=20.0,
        description=(
            "Heat trace cables on potable water pipes and storage tanks. "
            "Frozen pipes can rupture, causing immediate loss of drinking water."
        ),
        can_restart_remotely=True,
    ),

    # ---- OPERATIONAL (Tier 2) – shed only in genuine emergencies ---------
    StationLoad(
        name="Galley & Kitchen",
        tier=LoadTier.OPERATIONAL,
        power_kw=25.0,
        description=(
            "Cooking appliances, refrigeration, and dishwashing. "
            "Shedding reduces crew welfare but is survivable short-term."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Science Lab – Base Instruments",
        tier=LoadTier.OPERATIONAL,
        power_kw=30.0,
        description=(
            "Continuous environmental monitoring instruments (AWS, seismograph, "
            "magnetometer) that must run to maintain unbroken data records."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Water Desalination",
        tier=LoadTier.OPERATIONAL,
        power_kw=18.0,
        description=(
            "Reverse osmosis / snowmelt desalination plant providing potable "
            "water. Short-term shed acceptable if water tanks are full."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Wastewater Treatment",
        tier=LoadTier.OPERATIONAL,
        power_kw=12.0,
        description=(
            "Biological/chemical wastewater processing required by the Antarctic "
            "Treaty. Shed only if tanks have sufficient buffer capacity."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Workshop Equipment",
        tier=LoadTier.OPERATIONAL,
        power_kw=20.0,
        description=(
            "Machine shop tools and 3D printer for field equipment repair. "
            "Loss reduces station self-sufficiency."
        ),
        can_restart_remotely=True,
    ),

    # ---- DEFERRABLE (Tier 3) – shed first --------------------------------
    StationLoad(
        name="High-Power Science Experiments",
        tier=LoadTier.DEFERRABLE,
        power_kw=60.0,
        description=(
            "Power-intensive research apparatus (plasma chambers, large electromagnets, "
            "high-throughput spectrometers). Can be paused and resumed."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Rock Drill & Ice Core Equipment",
        tier=LoadTier.DEFERRABLE,
        power_kw=45.0,
        description=(
            "Rotary drill rigs and ice core processing equipment. "
            "Field ops can be paused for power emergencies."
        ),
        can_restart_remotely=False,
    ),
    StationLoad(
        name="Non-Critical Computing Servers",
        tier=LoadTier.DEFERRABLE,
        power_kw=15.0,
        description=(
            "Batch compute jobs (climate modelling, image processing). "
            "Jobs can be checkpointed and resumed."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Recreational Systems",
        tier=LoadTier.DEFERRABLE,
        power_kw=8.0,
        description=(
            "Entertainment centre, gym equipment, common-room heating supplement. "
            "Crew morale load – first to shed in any shortage."
        ),
        can_restart_remotely=True,
    ),
    StationLoad(
        name="Vehicle Battery Charging",
        tier=LoadTier.DEFERRABLE,
        power_kw=25.0,
        description=(
            "Electric snowmobile and tracked vehicle chargers. "
            "Can be deferred if vehicles are not needed for the next 12 hours."
        ),
        can_restart_remotely=True,
    ),
]


# ---------------------------------------------------------------------------
# Controller
# ---------------------------------------------------------------------------


class LoadSheddingController:
    """
    Automated priority-based load shedding controller for polar stations.

    Implements a 3-tier curtailment hierarchy (CRITICAL → OPERATIONAL →
    DEFERRABLE) with greedy largest-first selection within each tier.

    Attributes
    ----------
    loads : list[StationLoad]
        The station load inventory used for shed planning.
    """

    def __init__(self, loads: list[StationLoad] | None = None) -> None:
        self.loads: list[StationLoad] = loads if loads is not None else POLAR_STATION_LOADS

    # ------------------------------------------------------------------ #
    # Public methods                                                       #
    # ------------------------------------------------------------------ #

    def compute_available_power_gap(
        self, generation_kw: float, demand_kw: float
    ) -> float:
        """
        Compute the power surplus (+) or deficit (-) at the station bus.

        Parameters
        ----------
        generation_kw : float
            Total available generation (solar + wind + diesel + battery discharge).
        demand_kw : float
            Total active station demand (kW).

        Returns
        -------
        float
            Positive value → surplus (generation > demand).
            Negative value → deficit (generation < demand) → shedding needed.
        """
        return round(generation_kw - demand_kw, 3)

    def get_shed_plan(
        self,
        power_deficit_kw: float,
        scenario: str = "normal",
    ) -> dict[str, Any]:
        """
        Compute an optimal load shedding plan to recover the specified deficit.

        The algorithm sheds loads **tier-by-tier** (Tier 3 first, Tier 1 never),
        selecting the **largest load first** within each tier to minimise the
        number of switch events.

        Parameters
        ----------
        power_deficit_kw : float
            The power shortfall to recover (kW).  Must be > 0 to trigger
            shedding; pass the absolute value of ``compute_available_power_gap``
            when the gap is negative.
        scenario : str
            Context hint (e.g. ``"normal"``, ``"storm"``, ``"genset_failure"``).
            Affects alert severity messaging only.

        Returns
        -------
        dict
            Keys
            ~~~~
            shed_loads : list[str]
                Names of loads selected for shedding.
            shed_tiers : list[int]
                Tier numbers of each shed load.
            power_recovered_kw : float
                Total power recovered by the shed plan.
            deficit_remaining_kw : float
                Any unrecoverable deficit after Tier-2 exhaustion (should be 0).
            is_life_safe : bool
                True when no Tier-1 loads are shed.  Always True for this
                controller (Tier 1 is never touched).
            shedding_active : bool
                True when at least one load is being shed.
            alerts : list[str]
                Human-readable alert messages for the operator dashboard.
            shed_sequence : list[dict]
                Ordered sequence of shed actions with load name, kW, and tier.
        """
        if power_deficit_kw <= 0:
            return {
                "shed_loads":         [],
                "shed_tiers":         [],
                "power_recovered_kw": 0.0,
                "deficit_remaining_kw": 0.0,
                "is_life_safe":       True,
                "shedding_active":    False,
                "alerts":             [],
                "shed_sequence":      [],
            }

        remaining_deficit = power_deficit_kw
        shed_loads:    list[str]         = []
        shed_tiers:    list[int]         = []
        shed_sequence: list[dict]        = []
        alerts:        list[str]         = []
        power_recovered = 0.0
        order = 0

        # Iterate tiers in curtailment order (3 → 2; never 1)
        for tier in (LoadTier.DEFERRABLE, LoadTier.OPERATIONAL):
            if remaining_deficit <= 0:
                break

            tier_loads = sorted(
                [l for l in self.loads if l.tier == tier],
                key=lambda l: l.power_kw,
                reverse=True,  # largest first → fewest switch events
            )

            for load in tier_loads:
                if remaining_deficit <= 0:
                    break

                shed_loads.append(load.name)
                shed_tiers.append(int(tier))
                power_recovered   += load.power_kw
                remaining_deficit -= load.power_kw
                order             += 1

                shed_sequence.append(
                    {
                        "order":                order,
                        "load_name":            load.name,
                        "tier":                 int(tier),
                        "tier_name":            tier.name,
                        "power_kw":             load.power_kw,
                        "can_restart_remotely": load.can_restart_remotely,
                        "description":          load.description,
                    }
                )

            if tier == LoadTier.OPERATIONAL and remaining_deficit > 0:
                alerts.append(
                    f"[{scenario.upper()}] ALL Tier-2 OPERATIONAL loads shed – "
                    f"deficit of {remaining_deficit:.1f} kW still unresolved. "
                    "CRITICAL: Consider emergency generator start or station evacuation."
                )

        # If deficit still remains after both tiers → critical alert
        if remaining_deficit > 0:
            alerts.append(
                f"CRITICAL POWER DEFICIT: {remaining_deficit:.1f} kW cannot be recovered "
                "by load shedding alone. Possible causes: genset failure, major renewable "
                "outage. Initiate emergency protocol."
            )

        # Tier-2 partial shed alert
        if any(t == int(LoadTier.OPERATIONAL) for t in shed_tiers):
            alerts.append(
                "WARNING: Operational (Tier-2) loads shed. Station operational "
                "capacity reduced. Investigate generation shortfall immediately."
            )
        elif shed_loads:
            alerts.append(
                f"INFO: {len(shed_loads)} Deferrable (Tier-3) load(s) shed to cover "
                f"{power_deficit_kw:.1f} kW deficit. Station operations unaffected."
            )

        return {
            "shed_loads":             shed_loads,
            "shed_tiers":             shed_tiers,
            "power_recovered_kw":     round(power_recovered, 2),
            "deficit_remaining_kw":   round(max(0.0, remaining_deficit), 2),
            "is_life_safe":           True,   # Tier 1 NEVER shed
            "shedding_active":        len(shed_loads) > 0,
            "alerts":                 alerts,
            "shed_sequence":          shed_sequence,
        }

    def get_tier_summary(self) -> dict[str, Any]:
        """
        Return power totals and load counts per tier.

        Returns
        -------
        dict
            Keys: ``critical``, ``operational``, ``deferrable``, each mapping
            to a sub-dict with ``load_count`` and ``total_power_kw``.
            Also includes ``grand_total_kw``.
        """
        summary: dict[str, Any] = {}
        grand_total = 0.0

        for tier in LoadTier:
            tier_loads = [l for l in self.loads if l.tier == tier]
            total_kw   = sum(l.power_kw for l in tier_loads)
            grand_total += total_kw
            summary[tier.name.lower()] = {
                "load_count":     len(tier_loads),
                "total_power_kw": round(total_kw, 2),
                "loads":          [
                    {"name": l.name, "power_kw": l.power_kw}
                    for l in tier_loads
                ],
            }

        summary["grand_total_kw"] = round(grand_total, 2)
        return summary

    def assess_current_state(
        self,
        generation_kw: float,
        demand_kw: float,
        fuel_pct: float,
        battery_soc: float,
        temp_c: float,
    ) -> dict[str, Any]:
        """
        Perform a holistic power-system health assessment and shed decision.

        Two shedding triggers are evaluated:
        1. **Reactive shedding** – generation deficit > 5 % of demand
           (immediate power imbalance).
        2. **Pre-emptive shedding** – fuel level < 20 % (conserve remaining
           fuel for life-critical loads during a long polar resupply wait).

        Parameters
        ----------
        generation_kw : float
            Current total power generation (kW).
        demand_kw : float
            Current total station demand (kW).
        fuel_pct : float
            Current diesel tank fill level (0–100 %).
        battery_soc : float
            Current battery state-of-charge (0–100 %).
        temp_c : float
            Ambient temperature (°C).  Affects risk thresholds.

        Returns
        -------
        dict
            Comprehensive state assessment including:
            - ``power_gap_kw`` – surplus (+) or deficit (-)
            - ``shedding_required`` – immediate reactive shed needed
            - ``preemptive_shed_recommended`` – fuel conservation mode
            - ``shed_plan`` – result of :meth:`get_shed_plan` (if needed)
            - ``tier_summary`` – full tier power breakdown
            - ``system_status`` – ``"normal"``, ``"warning"``, or ``"critical"``
            - ``status_reasons`` – list of human-readable status explanations
        """
        gap = self.compute_available_power_gap(generation_kw, demand_kw)
        reactive_threshold = demand_kw * 0.05  # 5 % of demand

        shedding_required      = gap < -reactive_threshold
        preemptive_recommended = fuel_pct < 20.0

        status_reasons: list[str] = []

        if shedding_required:
            status_reasons.append(
                f"Power deficit of {abs(gap):.1f} kW exceeds 5% threshold "
                f"({reactive_threshold:.1f} kW). Immediate shedding required."
            )
        if preemptive_recommended:
            status_reasons.append(
                f"Fuel level at {fuel_pct:.1f}% (<20%). Pre-emptive shedding of "
                "Tier-3 loads recommended to extend fuel runway."
            )
        if battery_soc < 20:
            status_reasons.append(
                f"Battery SOC at {battery_soc:.1f}% – near minimum safe limit. "
                "Reduce non-critical loads immediately."
            )
        if temp_c < -35:
            status_reasons.append(
                f"Extreme temperature ({temp_c:.1f}°C) – heating loads are elevated "
                "and battery capacity is severely derated. Monitor generation closely."
            )

        # Determine overall system status
        if shedding_required or battery_soc < 15:
            system_status = "critical"
        elif preemptive_recommended or battery_soc < 25 or fuel_pct < 30:
            system_status = "warning"
        else:
            system_status = "normal"

        # Compute shed plan if any trigger is active
        shed_plan: dict[str, Any] = {}
        if shedding_required:
            shed_plan = self.get_shed_plan(
                power_deficit_kw=abs(gap),
                scenario="reactive",
            )
        elif preemptive_recommended:
            # Pre-emptive: shed only Tier-3 to reduce fuel burn
            tier3_total = sum(
                l.power_kw for l in self.loads if l.tier == LoadTier.DEFERRABLE
            )
            shed_plan = self.get_shed_plan(
                power_deficit_kw=tier3_total,
                scenario="preemptive_fuel_conservation",
            )
            # Only keep Tier-3 actions
            shed_plan["shed_loads"]     = [
                n for n, t in zip(shed_plan["shed_loads"], shed_plan["shed_tiers"])
                if t == int(LoadTier.DEFERRABLE)
            ]
            shed_plan["shed_sequence"]  = [
                s for s in shed_plan["shed_sequence"]
                if s["tier"] == int(LoadTier.DEFERRABLE)
            ]

        return {
            "generation_kw":                generation_kw,
            "demand_kw":                    demand_kw,
            "power_gap_kw":                 gap,
            "fuel_pct":                     fuel_pct,
            "battery_soc":                  battery_soc,
            "temperature_c":                temp_c,
            "shedding_required":            shedding_required,
            "preemptive_shed_recommended":  preemptive_recommended,
            "system_status":                system_status,
            "status_reasons":               status_reasons,
            "shed_plan":                    shed_plan,
            "tier_summary":                 self.get_tier_summary(),
        }
