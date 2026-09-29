"""
What-If Engine — simulates 24h energy scenarios with custom parameters.
"""
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime, timedelta
import random
import math


class WhatIfEngine:
    """
    Given a station and modified parameters, runs a 24-hour simulation
    and compares it to baseline operation.
    """

    def run_simulation(self, station, params: dict) -> dict:
        """
        Run a 24-hour simulation with modified parameters.
        Returns: comparison of baseline vs simulated metrics.
        """
        gen_baseline = PolarDataGenerator()
        gen_simulated = PolarDataGenerator()

        # Determine scenario string from flags
        scenario = "normal"
        if params.get("extreme_weather"):
            scenario = "storm"
        elif params.get("low_renewable"):
            scenario = "polar_night"
        elif params.get("high_demand"):
            scenario = "high_demand"
        elif not params.get("generator_available", True):
            scenario = "generator_failure"

        baseline_readings = []
        simulated_readings = []

        for h in range(24):
            ts = datetime.utcnow().replace(minute=0, second=0) + timedelta(hours=h)

            # Baseline reading
            b = gen_baseline.generate_reading(station, ts, "normal")
            baseline_readings.append(b)

            # Simulated reading (modified capacities)
            s = gen_simulated.generate_reading(station, ts, scenario)

            # Apply capacity modifications
            if params.get("solar_capacity_kw"):
                ratio = params["solar_capacity_kw"] / station.capacity_solar_kw
                s["solar_kw"] = round(s["solar_kw"] * ratio, 2)

            if params.get("wind_capacity_kw"):
                ratio = params["wind_capacity_kw"] / station.capacity_wind_kw
                s["wind_kw"] = round(s["wind_kw"] * ratio, 2)

            if params.get("battery_capacity_kwh"):
                # More battery = more flexible dispatch
                ratio = params["battery_capacity_kwh"] / station.capacity_battery_kwh
                s["battery_kw"] = round(s["battery_kw"] * min(ratio, 1.5), 2)

            # Load multiplier
            multiplier = params.get("load_multiplier", 1.0)
            s["total_load_kw"] = round(s["total_load_kw"] * multiplier, 2)

            # Generator unavailable
            if not params.get("generator_available", True):
                s["diesel_kw"] = 0.0

            # Fuel level override for display
            if params.get("fuel_level_pct") is not None:
                s["fuel_level_pct"] = params["fuel_level_pct"]

            # Temperature override
            if params.get("temperature_c") is not None:
                temp_diff = params["temperature_c"] - s["temperature_c"]
                s["temperature_c"] = params["temperature_c"]
                # Adjust heating load
                extra_heating = max(0, (-5 - params["temperature_c"]) * 5.5) - max(0, (-5 - (params["temperature_c"] - temp_diff)) * 5.5)
                s["total_load_kw"] = max(80, s["total_load_kw"] + extra_heating)

            # Recalculate derived metrics
            renewable_kw = s["solar_kw"] + s["wind_kw"]
            s["renewable_pct"] = round(min(100, renewable_kw / max(1, s["total_load_kw"]) * 100), 1)
            s["co2_emissions_kg"] = round(s["diesel_kw"] * 0.82 / 1000, 4)
            s["carbon_avoided_kg"] = round(renewable_kw * 0.82 / 1000, 4)

            simulated_readings.append(s)

        # ── Aggregate comparison ──────────────────────────────────────────────

        def agg(readings, key):
            return sum(r.get(key, 0) for r in readings)

        b_diesel = agg(baseline_readings, "diesel_kw")
        s_diesel = agg(simulated_readings, "diesel_kw")
        b_renewable = sum(r["solar_kw"] + r["wind_kw"] for r in baseline_readings)
        s_renewable = sum(r["solar_kw"] + r["wind_kw"] for r in simulated_readings)
        b_load = agg(baseline_readings, "total_load_kw")
        s_load = agg(simulated_readings, "total_load_kw")
        b_co2 = agg(baseline_readings, "co2_emissions_kg")
        s_co2 = agg(simulated_readings, "co2_emissions_kg")

        fuel_saved = (b_diesel - s_diesel) * 0.25  # liters
        co2_saved = (b_co2 - s_co2) * 1000         # kg

        # Reliability: % of hours demand was met
        def reliability(readings):
            met = sum(
                1 for r in readings
                if (r["solar_kw"] + r["wind_kw"] + r["battery_kw"] + r["diesel_kw"]) >= r["total_load_kw"] * 0.95
            )
            return round(met / len(readings) * 100, 1)

        b_reliability = reliability(baseline_readings)
        s_reliability = reliability(simulated_readings)

        # Battery backup duration (hours demand can be served from battery alone)
        battery_kwh = params.get("battery_capacity_kwh", station.capacity_battery_kwh)
        avg_net_demand = max(1, (s_load / 24) - (s_renewable / 24))
        backup_hours = round(battery_kwh * 0.8 / avg_net_demand, 1)  # 80% usable SOC

        # Hourly chart data for comparison
        hourly_comparison = []
        for h in range(24):
            b = baseline_readings[h]
            s = simulated_readings[h]
            hourly_comparison.append({
                "hour": h,
                "baseline_load_kw": b["total_load_kw"],
                "simulated_load_kw": s["total_load_kw"],
                "baseline_diesel_kw": b["diesel_kw"],
                "simulated_diesel_kw": s["diesel_kw"],
                "baseline_renewable_kw": b["solar_kw"] + b["wind_kw"],
                "simulated_renewable_kw": s["solar_kw"] + s["wind_kw"],
            })

        # Key changes explanation
        changes = []
        if params.get("solar_capacity_kw") and params["solar_capacity_kw"] != station.capacity_solar_kw:
            delta = params["solar_capacity_kw"] - station.capacity_solar_kw
            changes.append(f"Solar capacity {'increased' if delta > 0 else 'decreased'} by {abs(delta):.0f} kW → "
                           f"{'higher' if delta > 0 else 'lower'} renewable contribution.")
        if not params.get("generator_available", True):
            changes.append("Diesel generator is offline. Battery and renewables must cover all load. "
                           f"Critical loads are {'protected' if s_reliability >= 80 else 'at risk'}.")
        if params.get("extreme_weather"):
            changes.append("Storm conditions reduced solar to near-zero and cut wind turbine output (cut-out speed).")
        if params.get("low_renewable"):
            changes.append("Polar night conditions — zero solar for extended period. Increased diesel and battery dependency.")
        if params.get("high_demand") or (params.get("load_multiplier", 1.0) > 1.1):
            changes.append(f"Load increased by {(params.get('load_multiplier', 1.0) - 1) * 100:.0f}%. "
                           f"Diesel generator usage increased significantly.")
        if params.get("battery_capacity_kwh") and params["battery_capacity_kwh"] > station.capacity_battery_kwh:
            changes.append(f"Additional battery storage of "
                           f"{params['battery_capacity_kwh'] - station.capacity_battery_kwh:.0f} kWh reduces diesel dependency "
                           f"and extends backup duration by {backup_hours:.1f} hours.")

        if not changes:
            changes.append("Simulation running with current station parameters. No major changes detected.")

        return {
            "comparison": {
                "baseline": {
                    "fuel_consumption_liters_day": round(b_diesel * 0.25, 1),
                    "renewable_pct": round(b_renewable / max(1, b_load) * 100, 1),
                    "co2_kg_day": round(b_co2 * 1000, 1),
                    "reliability_pct": b_reliability,
                    "backup_hours": round(station.capacity_battery_kwh * 0.8 / max(1, b_load / 24 - b_renewable / 24), 1),
                    "avg_diesel_kw": round(b_diesel / 24, 1),
                },
                "simulated": {
                    "fuel_consumption_liters_day": round(s_diesel * 0.25, 1),
                    "renewable_pct": round(s_renewable / max(1, s_load) * 100, 1),
                    "co2_kg_day": round(s_co2 * 1000, 1),
                    "reliability_pct": s_reliability,
                    "backup_hours": backup_hours,
                    "avg_diesel_kw": round(s_diesel / 24, 1),
                },
            },
            "impact": {
                "fuel_saved_liters": round(fuel_saved, 1),
                "fuel_change_pct": round((s_diesel - b_diesel) / max(1, b_diesel) * 100, 1),
                "co2_saved_kg": round(co2_saved, 1),
                "renewable_change_pct": round((s_renewable - b_renewable) / max(1, b_renewable) * 100, 1),
                "reliability_change_pct": round(s_reliability - b_reliability, 1),
                "backup_hours_change": round(backup_hours - round(station.capacity_battery_kwh * 0.8 / max(1, b_load / 24 - b_renewable / 24), 1), 1),
            },
            "hourly_comparison": hourly_comparison,
            "changes_explained": changes,
            "parameters_used": params,
        }
