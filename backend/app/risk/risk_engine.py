"""
Enhanced Risk Engine — comprehensive polar energy risk assessment.
"""
import math
import random


class RiskEngine:
    """Computes a composite energy risk score for polar research stations."""

    # Weight of each risk factor in the overall score
    WEIGHTS = {
        "fuel":      0.30,
        "battery":   0.25,
        "weather":   0.20,
        "renewable": 0.15,
        "demand":    0.10,
    }

    def _fuel_risk_score(self, fuel_pct: float) -> float:
        """Higher score = more risk. Exponential near zero."""
        if fuel_pct >= 50:
            return 5
        if fuel_pct >= 30:
            return 20 + (50 - fuel_pct) * 0.6
        if fuel_pct >= 15:
            return 40 + (30 - fuel_pct) * 2.0
        return min(100, 70 + (15 - fuel_pct) * 2.5)

    def _battery_risk_score(self, soc: float, battery_kw: float) -> float:
        """Risk rises sharply as SOC approaches 20% floor."""
        if soc >= 60:
            return 5
        if soc >= 40:
            return 10 + (60 - soc) * 0.5
        if soc >= 25:
            return 20 + (40 - soc) * 2.0
        return min(100, 50 + (25 - soc) * 3.5)

    def _weather_risk_score(self, wind_kmh: float, temp_c: float) -> float:
        """Wind and extreme cold both increase operational risk."""
        wind_score = min(60, (wind_kmh / 80) * 60)
        cold_score = min(40, max(0, (-temp_c - 10) / 30 * 40))
        return wind_score + cold_score

    def _renewable_risk_score(self, renewable_pct: float) -> float:
        """Low renewable contribution increases diesel/battery dependency risk."""
        if renewable_pct >= 60:
            return 5
        if renewable_pct >= 30:
            return 10 + (60 - renewable_pct) * 0.5
        return 25 + (30 - renewable_pct) * 1.5

    def _demand_risk_score(self, load_kw: float, temp_c: float) -> float:
        """High heating demand relative to baseline increases risk."""
        base_load = 200
        excess = max(0, load_kw - base_load)
        heating_contribution = max(0, (-5 - temp_c) * 4)
        score = min(60, (excess / 300) * 40 + (heating_contribution / 200) * 20)
        return score

    def assess_risk(self, state: dict, forecast: list) -> dict:
        fuel_pct   = state.get("fuel_level_pct", 80)
        soc        = state.get("battery_soc_pct", 70)
        battery_kw = state.get("battery_kw", 0)
        wind       = state.get("wind_speed_kmh", 20)
        temp       = state.get("temperature_c", -20)
        renewable  = state.get("renewable_pct", 40)
        load       = state.get("total_load_kw", 200)

        scores = {
            "fuel":      self._fuel_risk_score(fuel_pct),
            "battery":   self._battery_risk_score(soc, battery_kw),
            "weather":   self._weather_risk_score(wind, temp),
            "renewable": self._renewable_risk_score(renewable),
            "demand":    self._demand_risk_score(load, temp),
        }

        overall = sum(scores[k] * self.WEIGHTS[k] for k in self.WEIGHTS)
        overall = round(min(100, overall), 1)

        if overall >= 75:
            level = "CRITICAL"
        elif overall >= 50:
            level = "HIGH"
        elif overall >= 25:
            level = "MEDIUM"
        else:
            level = "LOW"

        # ── Risk events ──────────────────────────────────────────────────────
        events = []

        if fuel_pct < 15:
            events.append({
                "name": "Critical Fuel Level",
                "level": "CRITICAL",
                "score": round(scores["fuel"], 1),
                "cause": f"Fuel tank at {fuel_pct:.1f}% — below emergency threshold of 15%.",
                "impact": "Diesel generator may fail within hours, leaving critical loads unprotected.",
                "recommended_action": "Immediately reduce all non-critical loads. Initiate emergency fuel resupply. Charge battery to maximum.",
            })
        elif fuel_pct < 30:
            events.append({
                "name": "Low Fuel Warning",
                "level": "HIGH",
                "score": round(scores["fuel"], 1),
                "cause": f"Fuel level at {fuel_pct:.1f}% — below recommended 30% reserve.",
                "impact": "Increased risk of power interruption if renewable generation drops.",
                "recommended_action": "Schedule fuel resupply. Reduce diesel generator runtime by maximising battery discharge during peak hours.",
            })

        if soc < 20:
            events.append({
                "name": "Battery Critical — Deep Discharge Risk",
                "level": "CRITICAL",
                "score": round(scores["battery"], 1),
                "cause": f"Battery SOC at {soc:.1f}% — below minimum safe threshold of 20%.",
                "impact": "Battery damage possible. Critical loads may lose backup power.",
                "recommended_action": "Activate diesel generator immediately. Do not discharge battery further. Allow renewable charging.",
            })
        elif soc < 35:
            events.append({
                "name": "Low Battery Reserve",
                "level": "HIGH",
                "score": round(scores["battery"], 1),
                "cause": f"Battery SOC at {soc:.1f}% — limited backup capacity available.",
                "impact": "Reduced ability to buffer demand spikes without diesel backup.",
                "recommended_action": f"Prioritise battery charging using available renewables. Defer non-critical loads.",
            })

        if wind > 70:
            events.append({
                "name": "Extreme Wind — Turbine Shutdown Risk",
                "level": "HIGH",
                "score": round(scores["weather"], 1),
                "cause": f"Wind speed at {wind:.1f} km/h — approaching turbine cut-out speed of 75 km/h.",
                "impact": "Wind turbines may auto-shutdown, reducing renewable output by up to 100%.",
                "recommended_action": "Pre-charge battery. Prepare diesel generator for immediate startup. Monitor turbine health.",
            })
        elif wind > 55:
            events.append({
                "name": "High Wind Warning",
                "level": "MEDIUM",
                "score": round(scores["weather"], 1),
                "cause": f"Wind speed at {wind:.1f} km/h.",
                "impact": "Wind turbine efficiency may decrease. Monitor for vibration and mechanical stress.",
                "recommended_action": "Monitor turbine sensors. Reduce non-essential loads as precaution.",
            })

        if temp < -35:
            events.append({
                "name": "Extreme Cold — High Heating Demand",
                "level": "HIGH",
                "score": round(scores["demand"], 1),
                "cause": f"Temperature at {temp:.1f}°C — well below operational baseline of -20°C.",
                "impact": "Heating load increased by ~{:.0f} kW. Higher diesel consumption expected.".format(max(0, (-5 - temp) * 5)),
                "recommended_action": "Implement zone-based heating. Reduce non-critical equipment. Maintain 60% battery reserve for heating backup.",
            })

        if renewable < 20:
            events.append({
                "name": "Low Renewable Generation",
                "level": "MEDIUM",
                "score": round(scores["renewable"], 1),
                "cause": f"Renewable sources covering only {renewable:.1f}% of load.",
                "impact": "Higher diesel dependency increases fuel consumption and CO₂ emissions.",
                "recommended_action": "Optimise load scheduling. Check solar panel snow coverage. Monitor wind turbine alignment.",
            })

        return {
            "score": overall,
            "level": level,
            "factor_scores": {
                "fuel":      round(scores["fuel"], 1),
                "battery":   round(scores["battery"], 1),
                "weather":   round(scores["weather"], 1),
                "renewable": round(scores["renewable"], 1),
                "demand":    round(scores["demand"], 1),
            },
            "events": events,
            "summary": f"{len(events)} active risk factor{'s' if len(events) != 1 else ''} detected. "
                       f"Overall risk score: {overall}/100.",
        }
