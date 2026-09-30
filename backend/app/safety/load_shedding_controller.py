"""
Load Shedding Controller — Automated Priority-Based Load Management
====================================================================
Implements the NCPOR three-tier load priority system for polar research
stations. Provides automated assessment, simulation, and shed plan
generation based on current station telemetry.

Tier System (per NCPOR EOS-007):
  Tier 1 — Life Safety:       Never shed. Medical, comms, survival heating.
  Tier 2 — Station Ops:       Shed in emergency only (fuel < 20% or SOC < 20%).
  Tier 3 — Non-Essential:     First to shed. Recreational, workshop, computing.

Usage:
    controller = LoadSheddingController()
    assessment = controller.assess_current_state(state, station)
    plan = controller.generate_shed_plan(deficit_kw=50.0, scenario="blizzard")
"""

from __future__ import annotations

from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# POLAR STATION LOAD CATALOGUE
# Each load: {id, name, tier, typical_kw, description, can_reduce, reduce_to_kw}
# ─────────────────────────────────────────────────────────────────────────────

POLAR_STATION_LOADS = [
    # ── TIER 1 — Life Safety (never shed) ────────────────────────────────────
    {
        "id": "T1-MED",
        "name": "Medical Bay",
        "tier": 1,
        "typical_kw": 5.0,
        "description": "Life support, defibrillator, O2 supply, medical refrigeration",
        "can_reduce": False,
        "reduce_to_kw": 5.0,
        "category": "life_safety",
    },
    {
        "id": "T1-COMM",
        "name": "Emergency Communications",
        "tier": 1,
        "typical_kw": 3.0,
        "description": "HF radio, satellite phone, VSAT uplink, beacon systems",
        "can_reduce": False,
        "reduce_to_kw": 3.0,
        "category": "life_safety",
    },
    {
        "id": "T1-FIRE",
        "name": "Fire Alarm & Suppression",
        "tier": 1,
        "typical_kw": 2.0,
        "description": "Smoke detectors, CO2 suppression pump, fire doors",
        "can_reduce": False,
        "reduce_to_kw": 2.0,
        "category": "life_safety",
    },
    {
        "id": "T1-EMRGLIGHT",
        "name": "Emergency Lighting",
        "tier": 1,
        "typical_kw": 1.0,
        "description": "LED battery-backed emergency escape route lighting",
        "can_reduce": False,
        "reduce_to_kw": 1.0,
        "category": "life_safety",
    },
    {
        "id": "T1-HEAT",
        "name": "Survival Heating (Sleeping Quarters)",
        "tier": 1,
        "typical_kw": 20.0,
        "description": "Minimum 15°C in personnel sleeping areas",
        "can_reduce": True,
        "reduce_to_kw": 15.0,  # reduced setpoint acceptable
        "category": "life_safety",
    },
    {
        "id": "T1-KITCHEN",
        "name": "Kitchen — Essential Circuit",
        "tier": 1,
        "typical_kw": 8.0,
        "description": "Minimum food preparation and hot water for survival",
        "can_reduce": True,
        "reduce_to_kw": 4.0,
        "category": "life_safety",
    },
    {
        "id": "T1-SERVERS-CORE",
        "name": "Core Data Servers",
        "tier": 1,
        "typical_kw": 5.0,
        "description": "Essential data storage: station logs, comms, safety systems",
        "can_reduce": False,
        "reduce_to_kw": 5.0,
        "category": "life_safety",
    },
    {
        "id": "T1-FUELPUMP",
        "name": "Fuel Pump System",
        "tier": 1,
        "typical_kw": 2.0,
        "description": "Day tank gravity-feed pump and generator fuel control",
        "can_reduce": False,
        "reduce_to_kw": 2.0,
        "category": "life_safety",
    },
    {
        "id": "T1-WATER",
        "name": "Water Treatment — Essential",
        "tier": 1,
        "typical_kw": 4.0,
        "description": "Potable water UV treatment and minimum circulation pump",
        "can_reduce": False,
        "reduce_to_kw": 4.0,
        "category": "life_safety",
    },

    # ── TIER 2 — Station Operations (shed in emergency) ───────────────────────
    {
        "id": "T2-LABHEATING",
        "name": "Laboratory Heating",
        "tier": 2,
        "typical_kw": 15.0,
        "description": "Full laboratory space heating — can reduce to instrument minimum",
        "can_reduce": True,
        "reduce_to_kw": 5.0,
        "category": "station_ops",
    },
    {
        "id": "T2-SCIINST",
        "name": "Scientific Instruments (Non-Critical)",
        "tier": 2,
        "typical_kw": 20.0,
        "description": "Research instruments — non-critical experiments can be paused",
        "can_reduce": True,
        "reduce_to_kw": 5.0,
        "category": "station_ops",
    },
    {
        "id": "T2-KITCHEN-FULL",
        "name": "Full Kitchen Operations",
        "tier": 2,
        "typical_kw": 12.0,
        "description": "Full cooking, dishwashing, refrigeration — reducible",
        "can_reduce": True,
        "reduce_to_kw": 0.0,  # T1-KITCHEN covers minimum
        "category": "station_ops",
    },
    {
        "id": "T2-LIGHTING",
        "name": "Dining & Common Area Lighting",
        "tier": 2,
        "typical_kw": 5.0,
        "description": "Full lighting in shared spaces — can switch to dimmed mode",
        "can_reduce": True,
        "reduce_to_kw": 1.0,
        "category": "station_ops",
    },
    {
        "id": "T2-HOTWATER",
        "name": "Hot Water System",
        "tier": 2,
        "typical_kw": 8.0,
        "description": "Continuous hot water heating — can switch to 6-hour scheduled",
        "can_reduce": True,
        "reduce_to_kw": 2.0,
        "category": "station_ops",
    },
    {
        "id": "T2-COMPUTING",
        "name": "Data Processing (Partial Cluster)",
        "tier": 2,
        "typical_kw": 15.0,
        "description": "Priority research computing — can reduce to essential nodes only",
        "can_reduce": True,
        "reduce_to_kw": 3.0,
        "category": "station_ops",
    },
    {
        "id": "T2-LAUNDRY",
        "name": "Laundry Facilities",
        "tier": 2,
        "typical_kw": 10.0,
        "description": "Washing machines and dryers — deferrable loads",
        "can_reduce": True,
        "reduce_to_kw": 0.0,
        "category": "station_ops",
    },
    {
        "id": "T2-WEATHER",
        "name": "Weather Monitoring Equipment",
        "tier": 2,
        "typical_kw": 3.0,
        "description": "AWS station, radiosonde equipment — critical for safety decisions",
        "can_reduce": False,
        "reduce_to_kw": 3.0,
        "category": "station_ops",
    },

    # ── TIER 3 — Non-Essential (first to shed) ────────────────────────────────
    {
        "id": "T3-REC",
        "name": "Recreation Room",
        "tier": 3,
        "typical_kw": 15.0,
        "description": "TV, games, gym equipment, social space — first to shed",
        "can_reduce": True,
        "reduce_to_kw": 0.0,
        "category": "non_essential",
    },
    {
        "id": "T3-WORKSHOP",
        "name": "Workshop Heating",
        "tier": 3,
        "typical_kw": 20.0,
        "description": "Electric workshop heating — frost protection only needed",
        "can_reduce": True,
        "reduce_to_kw": 3.0,  # frost protection minimum
        "category": "non_essential",
    },
    {
        "id": "T3-VEHICLEBAY",
        "name": "Vehicle/Cargo Bay Heating",
        "tier": 3,
        "typical_kw": 18.0,
        "description": "Equipment storage and vehicle bay heating — not life-safety",
        "can_reduce": True,
        "reduce_to_kw": 5.0,
        "category": "non_essential",
    },
    {
        "id": "T3-FULLCOMPUTE",
        "name": "Full Scientific Computing Cluster",
        "tier": 3,
        "typical_kw": 25.0,
        "description": "Full HPC cluster — non-priority modelling and analysis",
        "can_reduce": True,
        "reduce_to_kw": 0.0,
        "category": "non_essential",
    },
    {
        "id": "T3-TRAINING",
        "name": "Training & Conference Room",
        "tier": 3,
        "typical_kw": 5.0,
        "description": "Projectors, AV equipment, conference facilities",
        "can_reduce": True,
        "reduce_to_kw": 0.0,
        "category": "non_essential",
    },
    {
        "id": "T3-EXTLIGHT",
        "name": "Non-Essential Exterior Lighting",
        "tier": 3,
        "typical_kw": 3.0,
        "description": "Decorative and non-safety exterior lighting",
        "can_reduce": True,
        "reduce_to_kw": 0.0,
        "category": "non_essential",
    },
    {
        "id": "T3-SAUNA",
        "name": "Sauna/Extended Shower Block",
        "tier": 3,
        "typical_kw": 10.0,
        "description": "Sauna heater and extended shower facilities — luxury load",
        "can_reduce": True,
        "reduce_to_kw": 0.0,
        "category": "non_essential",
    },
    {
        "id": "T3-EV",
        "name": "Vehicle Charging (EV/Equipment)",
        "tier": 3,
        "typical_kw": 12.0,
        "description": "All electric vehicle and equipment battery charging",
        "can_reduce": True,
        "reduce_to_kw": 0.0,
        "category": "non_essential",
    },
]


class LoadSheddingController:
    """
    Automated load shedding assessment and planning controller.

    Implements the NCPOR three-tier priority system:
    - Continuously assesses current station state for shedding triggers
    - Generates ordered shed plans to cover power deficits
    - Provides tier-by-tier analysis and savings estimates
    """

    # ── Trigger thresholds ────────────────────────────────────────────────────
    FUEL_CRITICAL_PCT  = 20.0  # SOP 7.3 critical threshold
    FUEL_WARNING_PCT   = 35.0  # SOP 7.3 warning threshold
    SOC_CRITICAL_PCT   = 20.0  # Battery critical floor
    SOC_WARNING_PCT    = 30.0  # Battery warning level
    WIND_EMERGENCY_KMH = 100.0 # Blizzard emergency threshold (SOP 4.1)
    WIND_WARNING_KMH   = 75.0  # Blizzard warning threshold

    def __init__(self):
        self._loads = POLAR_STATION_LOADS
        # Pre-compute tier totals
        self._tier_totals = {1: 0.0, 2: 0.0, 3: 0.0}
        self._tier_sheddable = {1: 0.0, 2: 0.0, 3: 0.0}
        for load in self._loads:
            tier = load["tier"]
            self._tier_totals[tier] += load["typical_kw"]
            if load["can_reduce"]:
                self._tier_sheddable[tier] += load["typical_kw"] - load["reduce_to_kw"]

    # ── Public API ─────────────────────────────────────────────────────────────

    def assess_current_state(
        self,
        state: dict[str, Any],
        station: Any = None,
    ) -> dict[str, Any]:
        """
        Assess current station state and determine load shedding requirement.

        Parameters
        ----------
        state   : Telemetry dict from PolarDataGenerator (or similar)
        station : Station ORM object (optional — used for capacity context)

        Returns
        -------
        dict with full assessment, triggers, recommended actions, and shed plan
        """
        fuel_pct  = state.get("fuel_level_pct", 80.0)
        soc_pct   = state.get("battery_soc_pct", 72.0)
        wind_kmh  = state.get("wind_speed_kmh", 15.0)
        total_kw  = state.get("total_load_kw", 200.0)
        diesel_kw = state.get("diesel_kw", 0.0)
        solar_kw  = state.get("solar_kw", 0.0)
        wind_kw   = state.get("wind_kw", 0.0)
        temp_c    = state.get("temperature_c", -20.0)

        # ── Determine scenario from conditions ────────────────────────────────
        scenario = self._infer_scenario(fuel_pct, soc_pct, wind_kmh, state)

        # ── Evaluate triggers ─────────────────────────────────────────────────
        triggers = self._evaluate_triggers(fuel_pct, soc_pct, wind_kmh, total_kw, solar_kw + wind_kw)

        # ── Determine required shed level ─────────────────────────────────────
        shed_level = self._determine_shed_level(triggers)
        power_deficit = max(0.0, total_kw - (solar_kw + wind_kw + diesel_kw + abs(state.get("battery_kw", 0))))

        # ── Generate shed plan if needed ──────────────────────────────────────
        shed_plan = []
        if shed_level > 0 or power_deficit > 5:
            shed_target = max(power_deficit, self._shed_target_from_level(shed_level, total_kw))
            shed_plan = self.generate_shed_plan(shed_target, scenario)

        # ── Build assessment ──────────────────────────────────────────────────
        return {
            "status": shed_level,   # 0=normal, 1=voluntary, 2=mandatory, 3=emergency
            "status_label": ["NORMAL", "ADVISORY", "MANDATORY", "EMERGENCY"][min(shed_level, 3)],
            "scenario": scenario,
            "triggers": triggers,
            "power_balance": {
                "total_load_kw":    round(total_kw, 1),
                "solar_kw":         round(solar_kw, 1),
                "wind_kw":          round(wind_kw, 1),
                "diesel_kw":        round(diesel_kw, 1),
                "battery_kw":       round(state.get("battery_kw", 0), 1),
                "power_deficit_kw": round(power_deficit, 1),
            },
            "resource_levels": {
                "fuel_pct":        round(fuel_pct, 1),
                "battery_soc_pct": round(soc_pct, 1),
                "temperature_c":   round(temp_c, 1),
                "wind_speed_kmh":  round(wind_kmh, 1),
            },
            "shed_plan":    shed_plan,
            "total_sheddable_kw": {
                "tier3_full": round(self._tier_totals[3], 1),
                "tier3_sheddable": round(self._tier_sheddable[3], 1),
                "tier2_sheddable": round(self._tier_sheddable[2], 1),
                "tier1_reducible": round(self._tier_sheddable[1], 1),
            },
            "station_name": getattr(station, "name", "Unknown Station") if station else "Unknown",
        }

    def generate_shed_plan(
        self, power_deficit_kw: float, scenario: str = "normal"
    ) -> list[dict[str, Any]]:
        """
        Generate an ordered load-shedding plan to cover a power deficit.

        Sheds Tier 3 first, then Tier 2 if still needed.
        Never sheds Tier 1 (life safety) except for partial reduction of
        reducible Tier-1 loads in extreme emergency.

        Parameters
        ----------
        power_deficit_kw : Target kW to shed
        scenario         : "normal", "blizzard", "fuel_critical", "battery_critical"

        Returns
        -------
        List of load actions, each with: load_id, name, tier, action,
        current_kw, target_kw, savings_kw, reason
        """
        remaining_deficit = power_deficit_kw
        plan = []

        # Order loads: Tier 3 (by typical_kw desc), then Tier 2 (reducible only)
        tier3 = sorted(
            [l for l in self._loads if l["tier"] == 3 and l["can_reduce"]],
            key=lambda l: l["typical_kw"] - l["reduce_to_kw"],
            reverse=True
        )
        tier2 = sorted(
            [l for l in self._loads if l["tier"] == 2 and l["can_reduce"]],
            key=lambda l: l["typical_kw"] - l["reduce_to_kw"],
            reverse=True
        )

        for load in tier3 + tier2:
            if remaining_deficit <= 0:
                break
            savings = load["typical_kw"] - load["reduce_to_kw"]
            if savings <= 0:
                continue

            action = "OFF" if load["reduce_to_kw"] == 0 else "REDUCE"
            plan.append({
                "load_id":    load["id"],
                "name":       load["name"],
                "tier":       load["tier"],
                "action":     action,
                "current_kw": load["typical_kw"],
                "target_kw":  load["reduce_to_kw"],
                "savings_kw": round(savings, 1),
                "reason":     self._shed_reason(load, scenario),
                "priority":   "IMMEDIATE" if load["tier"] == 3 else "EMERGENCY",
            })
            remaining_deficit -= savings

        # Summary
        total_saved = sum(item["savings_kw"] for item in plan)

        return {
            "target_deficit_kw": round(power_deficit_kw, 1),
            "achievable_savings_kw": round(total_saved, 1),
            "deficit_covered": total_saved >= power_deficit_kw,
            "remaining_deficit_kw": round(max(0, power_deficit_kw - total_saved), 1),
            "actions": plan,
            "scenario": scenario,
            "tier3_actions": [a for a in plan if a["tier"] == 3],
            "tier2_actions": [a for a in plan if a["tier"] == 2],
        }

    def get_tier_summary(self) -> dict[str, Any]:
        """Return a complete summary of all loads organized by tier."""
        def _loads_for_tier(tier: int) -> list[dict]:
            return [
                {
                    "id":          l["id"],
                    "name":        l["name"],
                    "typical_kw":  l["typical_kw"],
                    "can_reduce":  l["can_reduce"],
                    "reduce_to_kw": l["reduce_to_kw"],
                    "savings_potential_kw": l["typical_kw"] - l["reduce_to_kw"] if l["can_reduce"] else 0,
                    "description": l["description"],
                    "category":    l["category"],
                }
                for l in self._loads if l["tier"] == tier
            ]

        return {
            "tier1": {
                "name": "Life Safety — Never Shed",
                "color": "red",
                "total_kw": round(self._tier_totals[1], 1),
                "sheddable_kw": 0.0,
                "loads": _loads_for_tier(1),
            },
            "tier2": {
                "name": "Station Operations — Emergency Only",
                "color": "orange",
                "total_kw": round(self._tier_totals[2], 1),
                "sheddable_kw": round(self._tier_sheddable[2], 1),
                "loads": _loads_for_tier(2),
            },
            "tier3": {
                "name": "Non-Essential — First to Shed",
                "color": "green",
                "total_kw": round(self._tier_totals[3], 1),
                "sheddable_kw": round(self._tier_sheddable[3], 1),
                "loads": _loads_for_tier(3),
            },
            "totals": {
                "all_loads_kw": round(sum(self._tier_totals.values()), 1),
                "max_sheddable_kw": round(self._tier_sheddable[2] + self._tier_sheddable[3], 1),
                "load_count": len(self._loads),
            },
        }

    # ── Private helpers ────────────────────────────────────────────────────────

    def _infer_scenario(
        self, fuel_pct: float, soc_pct: float, wind_kmh: float, state: dict
    ) -> str:
        if wind_kmh >= self.WIND_EMERGENCY_KMH:
            return "blizzard"
        if fuel_pct < self.FUEL_CRITICAL_PCT:
            return "fuel_critical"
        if soc_pct < self.SOC_CRITICAL_PCT:
            return "battery_critical"
        if wind_kmh >= self.WIND_WARNING_KMH:
            return "storm"
        if fuel_pct < self.FUEL_WARNING_PCT:
            return "fuel_low"
        return "normal"

    def _evaluate_triggers(
        self,
        fuel_pct: float,
        soc_pct: float,
        wind_kmh: float,
        total_kw: float,
        renewable_kw: float,
    ) -> list[dict]:
        triggers = []
        if fuel_pct < self.FUEL_CRITICAL_PCT:
            triggers.append({
                "type": "fuel_critical",
                "severity": "CRITICAL",
                "message": f"Fuel at {fuel_pct:.1f}% — below critical threshold ({self.FUEL_CRITICAL_PCT}%)",
                "sop_reference": "NCPOR SOP 7.3",
            })
        elif fuel_pct < self.FUEL_WARNING_PCT:
            triggers.append({
                "type": "fuel_warning",
                "severity": "WARNING",
                "message": f"Fuel at {fuel_pct:.1f}% — below advisory threshold ({self.FUEL_WARNING_PCT}%)",
                "sop_reference": "NCPOR SOP 7.3",
            })
        if soc_pct < self.SOC_CRITICAL_PCT:
            triggers.append({
                "type": "battery_critical",
                "severity": "CRITICAL",
                "message": f"Battery SOC at {soc_pct:.1f}% — below safe minimum ({self.SOC_CRITICAL_PCT}%)",
                "sop_reference": "NCPOR Battery Cold Weather Guide",
            })
        elif soc_pct < self.SOC_WARNING_PCT:
            triggers.append({
                "type": "battery_warning",
                "severity": "WARNING",
                "message": f"Battery SOC at {soc_pct:.1f}% — approaching minimum reserve ({self.SOC_WARNING_PCT}%)",
                "sop_reference": "NCPOR Battery Cold Weather Guide",
            })
        if wind_kmh >= self.WIND_EMERGENCY_KMH:
            triggers.append({
                "type": "blizzard_emergency",
                "severity": "CRITICAL",
                "message": f"Wind {wind_kmh:.0f} km/h — EMERGENCY blizzard (threshold: {self.WIND_EMERGENCY_KMH} km/h)",
                "sop_reference": "NCPOR SOP 4.1",
            })
        elif wind_kmh >= self.WIND_WARNING_KMH:
            triggers.append({
                "type": "storm_warning",
                "severity": "WARNING",
                "message": f"Wind {wind_kmh:.0f} km/h — storm warning (threshold: {self.WIND_WARNING_KMH} km/h)",
                "sop_reference": "NCPOR SOP 4.1",
            })

        power_deficit = max(0, total_kw - renewable_kw)
        if power_deficit > 50:
            triggers.append({
                "type": "power_deficit",
                "severity": "WARNING",
                "message": f"Power deficit of {power_deficit:.0f} kW vs renewable generation",
                "sop_reference": "NCPOR Load Priority Classification EOS-007",
            })

        return triggers

    def _determine_shed_level(self, triggers: list[dict]) -> int:
        """Return shed level: 0=normal, 1=advisory, 2=mandatory, 3=emergency."""
        severities = [t["severity"] for t in triggers]
        critical_types = [t["type"] for t in triggers if t["severity"] == "CRITICAL"]

        if "blizzard_emergency" in critical_types or (
            "fuel_critical" in critical_types and "battery_critical" in critical_types
        ):
            return 3  # Emergency — both critical
        if any(s == "CRITICAL" for s in severities):
            return 2  # Mandatory shedding
        if any(s == "WARNING" for s in severities):
            return 1  # Advisory / voluntary
        return 0  # Normal

    def _shed_target_from_level(self, level: int, total_kw: float) -> float:
        """Estimate kW to shed based on shed level."""
        if level == 3:
            return total_kw * 0.40  # Emergency: shed 40%
        if level == 2:
            return total_kw * 0.25  # Mandatory: shed 25%
        if level == 1:
            return total_kw * 0.10  # Advisory: shed 10%
        return 0.0

    def _shed_reason(self, load: dict, scenario: str) -> str:
        reasons = {
            "blizzard": "Blizzard emergency — mandatory load shedding per SOP 4.1",
            "fuel_critical": "Fuel critically low (<20%) — conservation per SOP 7.3",
            "battery_critical": "Battery below safe operating minimum — protecting reserve",
            "storm": "Storm conditions — precautionary load reduction",
            "fuel_low": f"Fuel advisory (<35%) — reducing non-essential consumption",
            "normal": "Load optimization — non-essential load during conservation mode",
        }
        return reasons.get(scenario, "Load shedding required by station conditions")
