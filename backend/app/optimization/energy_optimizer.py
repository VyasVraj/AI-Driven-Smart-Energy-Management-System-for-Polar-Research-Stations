"""
Enhanced Energy Optimizer — rule-based dispatch with weighted scoring.
"""
import math


class EnergyOptimizer:
    """
    Determines the optimal energy dispatch strategy for a polar research station.
    Priority: Solar > Wind > Battery > Diesel
    Objective: minimize diesel consumption while maintaining reliability and battery safety.
    """

    def compute_optimal_dispatch(self, state: dict) -> dict:
        demand         = state.get("current_demand", 200)
        solar_avail    = state.get("solar_available", 0)
        wind_avail     = state.get("wind_available", 0)
        soc            = state.get("battery_soc", 72)
        battery_cap    = state.get("battery_capacity", 500)
        fuel_pct       = state.get("fuel_level", 70)
        fuel_liters    = state.get("fuel_tank_liters", 50000) * (fuel_pct / 100)
        temp_c         = state.get("temperature", -20)
        scenario       = state.get("scenario", "normal")

        # Safe operating limits
        SOC_MIN    = 20   # Never discharge below this
        SOC_FLOOR  = 30   # Preferred floor
        MAX_DISCHARGE_KW = 120
        MAX_CHARGE_KW    = 80

        # ── Step 1: Use all available renewable (Priority 1 & 2) ────────────
        solar_used = min(solar_avail, demand)
        remaining  = demand - solar_used
        wind_used  = min(wind_avail, remaining)
        remaining -= wind_used

        # ── Step 2: Battery discharge if needed (Priority 3) ─────────────────
        battery_used = 0.0
        battery_charge = 0.0

        if remaining > 0 and soc > SOC_FLOOR:
            # How much energy can we safely extract from battery?
            usable_kwh = (soc - SOC_FLOOR) / 100 * battery_cap
            battery_used = min(remaining, usable_kwh, MAX_DISCHARGE_KW)
            remaining -= battery_used
        elif remaining <= 0:
            # Excess renewable → charge battery
            surplus = abs(remaining)
            if soc < 95:
                battery_charge = min(surplus, MAX_CHARGE_KW)

        # ── Step 3: Diesel generator (Priority 4) ───────────────────────────
        diesel_used = 0.0
        if remaining > 0:
            diesel_used = remaining

        # If fuel is critically low, shed non-critical loads instead
        if fuel_pct < 10 and diesel_used > 0:
            critical_load = demand * 0.6  # assume 60% is critical
            diesel_used = max(0, critical_load - solar_used - wind_used - battery_used)

        # ── Percentages ──────────────────────────────────────────────────────
        total = solar_used + wind_used + battery_used + diesel_used
        if total <= 0:
            total = 1

        def pct(v): return round(v / total * 100, 1)

        # ── Savings calculation ───────────────────────────────────────────────
        # Baseline: all diesel
        baseline_diesel = demand
        actual_diesel   = diesel_used
        diesel_saved_kw = baseline_diesel - actual_diesel
        diesel_saved_liters = diesel_saved_kw * 0.25  # 0.25 L/kWh efficiency
        co2_saved_kg        = diesel_saved_liters * 2.68   # kg CO2 per liter diesel

        # Fuel duration at current rate
        consumption_lh = max(0.1, diesel_used * 0.25)
        days_remaining = fuel_liters / (consumption_lh * 24) if consumption_lh > 0 else 999

        # ── Explanation ───────────────────────────────────────────────────────
        explanation = []

        if solar_used > 5:
            explanation.append(
                f"☀️ Using {solar_used:.1f} kW solar (Priority 1) — free renewable energy, zero emissions."
            )
        if wind_used > 5:
            explanation.append(
                f"💨 Using {wind_used:.1f} kW wind (Priority 2) — cost-free and available 24/7."
            )
        if battery_used > 5:
            explanation.append(
                f"🔋 Discharging battery {battery_used:.1f} kW (Priority 3) — SOC at {soc:.1f}%, above {SOC_FLOOR}% floor. "
                f"Avoids {battery_used * 0.25:.1f} L of diesel."
            )
        elif battery_charge > 5:
            explanation.append(
                f"🔋 Charging battery with {battery_charge:.1f} kW excess renewable — storing energy for evening peak."
            )
        else:
            explanation.append(
                f"🔋 Battery held in reserve (SOC: {soc:.1f}%) — preserving capacity for demand peaks."
            )
        if diesel_used > 5:
            explanation.append(
                f"⚙️ Diesel generator at {diesel_used:.1f} kW (Priority 4) — required to cover remaining {diesel_used:.1f} kW demand gap."
            )
        else:
            explanation.append(
                "✅ Diesel generator offline — renewable + battery covering full load. Maximum fuel conservation."
            )

        if temp_c < -25:
            explanation.append(
                f"❄️ Temperature {temp_c:.1f}°C detected — elevated heating load included in demand calculation."
            )

        if fuel_pct < 25:
            explanation.append(
                f"⚠️ Fuel at {fuel_pct:.1f}% — conservative diesel dispatch activated. Non-critical loads should be deferred."
            )

        return {
            "solar_pct": pct(solar_used),
            "wind_pct": pct(wind_used),
            "battery_pct": pct(battery_used),
            "diesel_pct": pct(diesel_used),
            "solar_kw": round(solar_used, 1),
            "wind_kw": round(wind_used, 1),
            "battery_kw": round(battery_used, 1),
            "diesel_kw": round(diesel_used, 1),
            "total_demand_kw": round(demand, 1),
            "explanation": explanation,
            "expected_savings": {
                "diesel_liters_per_hour": round(diesel_saved_liters, 2),
                "co2_kg_per_hour": round(co2_saved_kg, 2),
                "diesel_liters": round(diesel_saved_liters, 2),
                "co2_kg": round(co2_saved_kg, 2),
                "fuel_days_remaining": round(days_remaining, 1),
            },
            "renewable_contribution_pct": pct(solar_used + wind_used),
            "battery_status": {
                "soc_pct": soc,
                "safe_range": soc >= SOC_MIN,
                "action": "discharging" if battery_used > 0 else ("charging" if battery_charge > 0 else "idle"),
            },
        }
