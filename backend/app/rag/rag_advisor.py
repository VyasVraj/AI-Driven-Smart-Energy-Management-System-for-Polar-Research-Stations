"""
RAG-Enhanced Polar Station Advisor
====================================
Combines retrieved knowledge documents (from PolarKnowledgeBase) with
real-time station telemetry to generate grounded, actionable advisory
responses for polar station operators.

No external LLM API is required. Responses are generated using
template-based synthesis that explicitly references retrieved documents
and live telemetry values.

Usage:
    advisor = RAGAdvisor()
    result = advisor.answer("How much fuel do we have?", station_telemetry)
"""

import re
from datetime import datetime
from typing import Optional
from app.rag.polar_knowledge_base import PolarKnowledgeBase


class RAGAdvisor:
    """
    Retrieval-Augmented Generation advisor for polar station energy management.

    Workflow:
      1. Classify the query into a topic domain (fuel, battery, blizzard, etc.)
      2. Retrieve top-3 relevant knowledge documents via PolarKnowledgeBase
      3. Build a grounded context string combining telemetry + document excerpts
      4. Generate a detailed, structured response referencing specific docs + metrics
      5. Return enriched response dict with sources, metrics, action items, confidence
    """

    def __init__(self):
        """Initialize RAGAdvisor with a PolarKnowledgeBase instance."""
        self._kb = PolarKnowledgeBase()

    @property
    def kb(self) -> PolarKnowledgeBase:
        return self._kb


    # ── Public API ────────────────────────────────────────────────────────────

    def answer(self, query: str, station_telemetry: dict) -> dict:
        """
        Generate a RAG-grounded answer for an operator query.

        Args:
            query:             Natural language question from the operator
            station_telemetry: Current telemetry dict from PolarDataGenerator
                               Expected keys: total_load_kw, solar_kw, wind_kw,
                               diesel_kw, battery_soc_pct, fuel_level_pct,
                               renewable_pct, temperature_c, wind_speed_kmh,
                               battery_kw, solar_irradiance_wm2, co2_emissions_kg

        Returns:
            {
              answer:            str  — main detailed response
              reasoning:         str  — step-by-step analytical reasoning
              sources:           list — [{title, category, relevance_score}, ...]
              key_metrics:       list — [{label, value, unit}, ...]
              action_items:      list — concrete actions to take
              confidence:        float (0–1)
              rag_context_used:  bool
              telemetry_grounded: bool
            }
        """
        query_lower = query.lower()

        # Step 1: Classify query domain
        domain = self._classify_domain(query_lower)

        # Step 2: Retrieve top-3 relevant documents
        retrieved = self._kb.retrieve(query, top_k=3)
        rag_context_used = len(retrieved) > 0

        # Step 3: Build telemetry context
        telemetry_grounded = bool(station_telemetry)
        t = station_telemetry  # shorthand

        # Step 4: Route to domain-specific generator
        generator_map = {
            "fuel":        self._generate_fuel_answer,
            "battery":     self._generate_battery_answer,
            "blizzard":    self._generate_blizzard_answer,
            "generator":   self._generate_generator_answer,
            "load_shedding": self._generate_load_shedding_answer,
            "renewable":   self._generate_renewable_answer,
            "environmental": self._generate_environmental_answer,
            "general":     self._generate_general_answer,
        }

        generator_fn = generator_map.get(domain, self._generate_general_answer)
        response = generator_fn(query, t, retrieved)

        # Step 5: Attach metadata
        response["sources"] = [
            {
                "title": r["document"]["title"],
                "category": r["document"]["category"],
                "relevance_score": r["relevance_score"],
                "doc_id": r["document"]["id"],
                "source_ref": r["document"]["source"],
            }
            for r in retrieved
        ]
        response["rag_context_used"] = rag_context_used
        response["telemetry_grounded"] = telemetry_grounded
        response["query"] = query
        response["domain"] = domain
        response["timestamp"] = datetime.utcnow().isoformat()
        response["knowledge_base_size"] = self._kb.document_count

        return response

    # ── Domain Classifier ─────────────────────────────────────────────────────

    def _classify_domain(self, query_lower: str) -> str:
        """
        Classify the query into one of the known domains using keyword matching.
        Returns domain string used to select the appropriate response generator.
        """
        domain_signals = {
            "fuel":      ["fuel", "diesel", "tank", "refuel", "runway", "resupply",
                          "liters", "litres", "fuel level", "fuel reserve"],
            "battery":   ["battery", "soc", "state of charge", "charge", "discharge",
                          "storage", "lithium", "backup", "kwh", "battery health",
                          "soh", "state of health", "cell"],
            "blizzard":  ["blizzard", "storm", "emergency", "whiteout", "wind speed",
                          "wind threshold", "hurricane", "gale", "alert", "polar storm"],
            "generator": ["generator", "genset", "diesel gen", "wet stacking",
                          "cold start", "engine", "startup", "exhaust", "smoke",
                          "runtime", "minimum load"],
            "load_shedding": ["load shedding", "shed load", "shed", "tier",
                              "priority", "cut load", "power cut", "deficit",
                              "load reduction", "load management"],
            "renewable": ["solar", "wind", "renewable", "mppt", "curtail",
                          "turbine", "panel", "irradiance", "green energy",
                          "clean energy", "sustainable"],
            "environmental": ["co2", "carbon", "emission", "treaty", "environmental",
                              "madrid protocol", "pollution", "compliance", "greenhouse",
                              "climate", "monitoring", "annual limit"],
            "general":   ["status", "overview", "summary", "current", "how is",
                          "what is", "overall", "situation"],
        }

        scores = {domain: 0 for domain in domain_signals}
        for domain, signals in domain_signals.items():
            for sig in signals:
                if sig in query_lower:
                    scores[domain] += 1

        # Return highest-scoring domain, default to "general"
        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else "general"

    # ── Domain-Specific Response Generators ──────────────────────────────────

    def _generate_fuel_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate detailed fuel/diesel advisory grounded in SOP 7.3."""
        fuel_pct = t.get("fuel_level_pct", 0)
        diesel_kw = t.get("diesel_kw", 0)
        fuel_tank_liters = t.get("fuel_tank_liters", 50000)

        # Fuel runway calculation
        fuel_liters_remaining = (fuel_pct / 100.0) * fuel_tank_liters
        consumption_lh = max(0.1, diesel_kw * 0.25)  # L/h at 0.25 L/kWh
        runway_hours = fuel_liters_remaining / consumption_lh
        runway_days = runway_hours / 24.0

        # Determine alert level per SOP 7.3
        if fuel_pct >= 60:
            alert_level = "🟢 OPERATIONAL"
            alert_desc = "Fuel reserves are healthy. Normal operations continue."
        elif fuel_pct >= 35:
            alert_level = "🟡 ADVISORY"
            alert_desc = "Begin resupply planning. Report status in weekly station report."
        elif fuel_pct >= 20:
            alert_level = "🟠 WARNING"
            alert_desc = "Activate 10% demand reduction protocol. Notify NCPOR HQ immediately."
        else:
            alert_level = "🔴 CRITICAL"
            alert_desc = "Emergency resupply request required. Reduce to essential operations."

        # Reference best retrieved document
        primary_doc = retrieved[0]["document"] if retrieved else {}
        doc_title = primary_doc.get("title", "NCPOR SOP 7.3")
        excerpt = retrieved[0]["excerpt"] if retrieved else ""

        answer = (
            f"**Fuel Status Assessment** — Per {doc_title}:\n\n"
            f"**{alert_level}** — {alert_desc}\n\n"
            f"**Current Fuel Level:** {fuel_pct:.1f}% "
            f"({fuel_liters_remaining:,.0f} L remaining of {fuel_tank_liters:,.0f} L total)\n\n"
            f"**Diesel Generation:** {diesel_kw:.1f} kW active\n"
            f"**Consumption Rate:** {consumption_lh:.1f} L/hour ({consumption_lh * 24:.0f} L/day)\n\n"
            f"**⏱️ Fuel Runway:** {runway_days:.1f} days "
            f"({runway_hours:.0f} hours) at current consumption rate.\n\n"
            f"Per NCPOR SOP 7.3 thresholds:\n"
            f"  • Operational (>60%): {'✅ Met' if fuel_pct >= 60 else '❌ Not met'}\n"
            f"  • Advisory threshold (35%): {'Above' if fuel_pct >= 35 else '⚠️ Below — initiate resupply'}\n"
            f"  • Warning threshold (20%): {'Above' if fuel_pct >= 20 else '🔴 Below — emergency protocol'}\n"
            f"  • Critical threshold: {'Above' if fuel_pct >= 20 else '🚨 CRITICAL — EMERGENCY RESUPPLY'}"
        )

        reasoning = (
            f"**Fuel Runway Formula (SOP 7.3):**\n"
            f"Runway = Available Fuel / Consumption Rate\n"
            f"= {fuel_liters_remaining:,.0f} L / {consumption_lh:.1f} L/h\n"
            f"= {runway_days:.1f} days\n\n"
            f"**Diesel dependency context:**\n"
            f"Renewable fraction is {t.get('renewable_pct', 0):.1f}% of load "
            f"({t.get('solar_kw', 0):.1f} kW solar + {t.get('wind_kw', 0):.1f} kW wind). "
            f"Higher renewable generation directly reduces diesel consumption and "
            f"extends fuel runway. Battery SOC is {t.get('battery_soc_pct', 0):.1f}% — "
            f"{'battery can buffer load and reduce diesel runtime' if t.get('battery_soc_pct', 0) > 40 else 'battery reserve is low, limiting ability to substitute diesel'}.\n\n"
            f"**Reference document excerpt:** {excerpt[:300]}"
        )

        action_items = []
        if fuel_pct < 35:
            action_items.append("🚨 Initiate resupply logistics immediately — minimum 52 days lead time for Antarctic resupply")
        if fuel_pct < 20:
            action_items.append("📡 Notify NCPOR Headquarters emergency operations center")
            action_items.append("⚡ Activate load shedding Tier-3 loads to reduce diesel consumption")
        if t.get("renewable_pct", 0) < 30 and t.get("battery_soc_pct", 0) > 50:
            action_items.append("🔋 Maximize battery discharge to reduce diesel runtime during peak renewable windows")
        action_items.append(f"📋 Calculate: At {t.get('wind_kw', 0):.0f} kW wind + {t.get('solar_kw', 0):.0f} kW solar, consider reducing diesel to minimum 40% load (wet stacking prevention)")
        if not action_items:
            action_items.append("📊 Continue current operations. Schedule next fuel level audit in 7 days.")

        confidence = 0.95 if retrieved else 0.75

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Fuel Level", "value": round(fuel_pct, 1), "unit": "%"},
                {"label": "Fuel Remaining", "value": round(fuel_liters_remaining, 0), "unit": "L"},
                {"label": "Diesel Output", "value": round(diesel_kw, 1), "unit": "kW"},
                {"label": "Consumption Rate", "value": round(consumption_lh, 1), "unit": "L/h"},
                {"label": "Fuel Runway", "value": round(runway_days, 1), "unit": "days"},
                {"label": "Renewable Fraction", "value": round(t.get("renewable_pct", 0), 1), "unit": "%"},
            ],
            "action_items": action_items,
            "confidence": confidence,
        }

    def _generate_battery_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate detailed battery advisory grounded in cold-weather battery docs."""
        soc = t.get("battery_soc_pct", 0)
        temp_c = t.get("temperature_c", -20)
        battery_kw = t.get("battery_kw", 0)
        capacity_kwh = t.get("capacity_battery_kwh", 500)

        # Cold derating estimate per BATT-CW-002 table
        if temp_c >= 15:
            derating_factor = 0.98
        elif temp_c >= 5:
            derating_factor = 0.95
        elif temp_c >= 0:
            derating_factor = 0.90
        elif temp_c >= -10:
            derating_factor = 0.78
        elif temp_c >= -20:
            derating_factor = 0.62
        elif temp_c >= -30:
            derating_factor = 0.45
        else:
            derating_factor = 0.25

        effective_capacity = capacity_kwh * derating_factor
        current_energy_kwh = (soc / 100.0) * effective_capacity
        usable_energy_kwh = max(0, (soc - 20) / 100.0 * effective_capacity)  # above 20% floor

        # Battery status
        if soc >= 80:
            status = "✅ Excellent — Battery well-charged"
        elif soc >= 50:
            status = "✅ Good — Operating within normal range"
        elif soc >= 30:
            status = "⚠️ Moderate — Monitor closely"
        elif soc >= 20:
            status = "🟠 Low — Approach minimum reserve"
        else:
            status = "🔴 CRITICAL — Below safe operating threshold"

        charging_allowed = temp_c >= 0  # Per BATT-CW-002 charging cutoff

        primary_doc = retrieved[0]["document"] if retrieved else {}
        doc_title = primary_doc.get("title", "Lithium Battery Cold Weather Guide")
        excerpt = retrieved[0]["excerpt"] if retrieved else ""

        answer = (
            f"**Battery Status Assessment** — Per {doc_title}:\n\n"
            f"**{status}**\n\n"
            f"**SOC:** {soc:.1f}% | Current Flow: "
            f"{'🔋 Charging at ' + str(abs(battery_kw)) + ' kW' if battery_kw < 0 else '⚡ Discharging at ' + str(battery_kw) + ' kW' if battery_kw > 0 else '⏸️ Idle'}\n\n"
            f"**Temperature Context:** {temp_c:.1f}°C (ambient)\n"
            f"**Cold-Weather Capacity Derating:** {derating_factor*100:.0f}% of rated capacity available\n"
            f"  → Rated capacity: {capacity_kwh:.0f} kWh\n"
            f"  → Effective capacity at {temp_c:.0f}°C: **{effective_capacity:.0f} kWh**\n"
            f"  → Current stored energy: **{current_energy_kwh:.0f} kWh**\n"
            f"  → Usable above 20% SOC floor: **{usable_energy_kwh:.0f} kWh**\n\n"
            f"**Charging Status:** {'✅ Charging permitted (temp ≥ 0°C)' if charging_allowed else '🔴 CHARGING INHIBITED — Temperature ' + str(temp_c) + '°C < 0°C cutoff (per SOP). Risk of lithium plating.'}\n\n"
            f"Per NCPOR Battery Cold Weather Guide:\n"
            f"  • Minimum SOC floor: 20% (never discharge below)\n"
            f"  • Safe operating window: 30%–85% SOC in polar winter\n"
            f"  • Battery heating blankets: activate below 5°C internal temp"
        )

        reasoning = (
            f"**Cold Derating Calculation:**\n"
            f"Ambient temperature = {temp_c:.1f}°C\n"
            f"Derating factor from NCPOR table = {derating_factor*100:.0f}%\n"
            f"Effective capacity = {capacity_kwh:.0f} × {derating_factor:.2f} = {effective_capacity:.0f} kWh\n\n"
            f"**SOC Analysis:**\n"
            f"Current SOC = {soc:.1f}%, equating to {current_energy_kwh:.0f} kWh of energy.\n"
            f"With 20% reserve floor, usable energy = {usable_energy_kwh:.0f} kWh.\n"
            f"At current load of {t.get('total_load_kw', 0):.1f} kW, battery-only runtime ≈ "
            f"{usable_energy_kwh / max(1, t.get('total_load_kw', 1)):.1f} hours.\n\n"
            f"**Reference excerpt:** {excerpt[:300]}"
        )

        action_items = []
        if not charging_allowed:
            action_items.append("🌡️ Activate battery heating blankets immediately — minimum 45 min warm-up before charging at -20°C")
            action_items.append("🔌 Do NOT charge battery until internal temperature reaches 0°C (BMS should auto-lock)")
        if soc < 20:
            action_items.append("🚨 EMERGENCY: Start diesel generator immediately — battery at critical level")
            action_items.append("⚡ Implement Tier-3 load shedding to preserve remaining battery capacity")
        elif soc < 35:
            action_items.append("⚠️ Schedule battery recharge cycle during next renewable generation window")
            action_items.append("🔋 Activate diesel generator to support load and begin charging")
        if soc > 90:
            action_items.append("📉 Reduce charging rate — high SOC + cold temp increases lithium plating risk")

        confidence = 0.93 if retrieved else 0.78

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Battery SOC", "value": round(soc, 1), "unit": "%"},
                {"label": "Ambient Temp", "value": round(temp_c, 1), "unit": "°C"},
                {"label": "Capacity Derating", "value": round(derating_factor * 100, 0), "unit": "%"},
                {"label": "Effective Capacity", "value": round(effective_capacity, 0), "unit": "kWh"},
                {"label": "Usable Energy", "value": round(usable_energy_kwh, 0), "unit": "kWh"},
                {"label": "Battery Flow", "value": round(battery_kw, 1), "unit": "kW"},
                {"label": "Charging Allowed", "value": 1 if charging_allowed else 0, "unit": "bool"},
            ],
            "action_items": action_items,
            "confidence": confidence,
        }

    def _generate_blizzard_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate step-by-step blizzard emergency advisory grounded in SOP 4.1."""
        wind_kmh = t.get("wind_speed_kmh", 0)
        temp_c = t.get("temperature_c", -20)
        soc = t.get("battery_soc_pct", 0)
        fuel_pct = t.get("fuel_level_pct", 0)
        conditions = t.get("conditions", "Clear")

        # Determine current alert level
        if wind_kmh >= 100:
            alert_level = "🔴 EMERGENCY (Red) — Whiteout Conditions"
            alert_step = "MANDATORY LOAD SHEDDING REQUIRED"
        elif wind_kmh >= 75:
            alert_level = "🟠 WARNING (Orange) — Severe Storm"
            alert_step = "Restrict outdoor movement. Switch to generator primary power."
        elif wind_kmh >= 50:
            alert_level = "🟡 ADVISORY (Yellow) — Storm Building"
            alert_step = "Pre-position fuel. Check generator oil. Alert all personnel."
        else:
            alert_level = "🟢 NORMAL — No Blizzard Alert"
            alert_step = "Conditions within normal range. Monitor weather updates."

        primary_doc = retrieved[0]["document"] if retrieved else {}
        doc_title = primary_doc.get("title", "NCPOR SOP 4.1")
        excerpt = retrieved[0]["excerpt"] if retrieved else ""

        answer = (
            f"**Blizzard Emergency Assessment** — Per {doc_title}:\n\n"
            f"**Alert Level: {alert_level}**\n"
            f"**Required Action: {alert_step}**\n\n"
            f"**Current Conditions:**\n"
            f"  • Wind Speed: {wind_kmh:.1f} km/h | Conditions: {conditions}\n"
            f"  • Temperature: {temp_c:.1f}°C\n"
            f"  • Battery SOC: {soc:.1f}% | Fuel Level: {fuel_pct:.1f}%\n\n"
            f"**NCPOR SOP 4.1 Response Protocol:**\n\n"
            f"**Step 1 — Power System Actions:**\n"
            f"  {'• Switch to Diesel Generator #1 as sole power source' if wind_kmh >= 75 else '• Pre-position generators for rapid switch'}\n"
            f"  {'• Disconnect solar array (ice/snow accumulation risk)' if wind_kmh >= 75 else '• Monitor solar output for ice accumulation'}\n"
            f"  • Wind turbines auto-shutdown at ≥75 km/h (cut-out speed)\n"
            f"  • {'Battery is below 80% — precharge to 95% SOC now' if soc < 80 else 'Battery at ' + str(round(soc,1)) + '% — maintain above 40% SOC'}\n\n"
            f"**Step 2 — Load Shedding Sequence (if Emergency/Red):**\n"
            f"  1. Non-essential lighting → save ~8 kW\n"
            f"  2. Workshop electric heating → save ~15 kW\n"
            f"  3. Vehicle bay heating → save ~20 kW\n"
            f"  4. Ice melting plant (minimum flow mode) → save ~12 kW\n"
            f"  5. Scientific instruments (non-critical) → save ~10 kW\n"
            f"  6. Computing cluster → reduce to essential nodes → save ~25 kW\n"
            f"  **Total potential savings: ~90 kW (35–40% of normal load)**\n\n"
            f"**Step 3 — Generator Load Target:**\n"
            f"  Maintain diesel generator between 40–70% rated capacity\n"
            f"  {'Deploy second generator in hot-standby if blizzard exceeds 8 hours' if wind_kmh >= 75 else 'Keep Generator #2 in warm-standby'}"
        )

        reasoning = (
            f"**Wind Speed Analysis vs SOP 4.1 Thresholds:**\n"
            f"Current wind: {wind_kmh:.1f} km/h\n"
            f"  • Advisory threshold (50 km/h): {'✅ Exceeded' if wind_kmh >= 50 else '❌ Not reached'}\n"
            f"  • Warning threshold (75 km/h): {'✅ Exceeded' if wind_kmh >= 75 else '❌ Not reached'}\n"
            f"  • Emergency threshold (100 km/h): {'✅ Exceeded' if wind_kmh >= 100 else '❌ Not reached'}\n\n"
            f"**Risk factors:**\n"
            f"Battery SOC = {soc:.1f}% — {'Adequate reserve for isolation' if soc >= 40 else 'LOW — critical risk if generator fails'}\n"
            f"Fuel level = {fuel_pct:.1f}% — {'Adequate for extended blizzard operation' if fuel_pct >= 35 else 'WARNING — limited fuel for extended storm'}\n\n"
            f"**Document reference:** {excerpt[:300]}"
        )

        action_items = []
        if wind_kmh >= 100:
            action_items.append("🚨 EMERGENCY: Implement mandatory load shedding — Tier 3 loads OFF immediately")
            action_items.append("📻 Activate HF radio — notify NCPOR HQ of emergency status")
            action_items.append("🔌 Disconnect solar array to prevent panel damage")
        if wind_kmh >= 75:
            action_items.append("⛽ Restrict all outdoor movement except emergency personnel")
            action_items.append("🔋 Pre-charge battery bank to 95% SOC before conditions worsen")
            action_items.append("⚙️ Start Diesel Generator #1 — switch to generator primary power")
        if wind_kmh >= 50:
            action_items.append("📋 Pre-position fuel and check generator oil levels")
            action_items.append("👥 Alert all personnel — blizzard advisory active")
        if soc < 40:
            action_items.append("⚡ LOW BATTERY WARNING: Prioritize battery charging before storm intensifies")
        if fuel_pct < 30:
            action_items.append("⚠️ LOW FUEL WARNING: Conserve diesel — storm may last extended period")

        confidence = 0.96 if retrieved else 0.80

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Wind Speed", "value": round(wind_kmh, 1), "unit": "km/h"},
                {"label": "Temperature", "value": round(temp_c, 1), "unit": "°C"},
                {"label": "Battery SOC", "value": round(soc, 1), "unit": "%"},
                {"label": "Fuel Level", "value": round(fuel_pct, 1), "unit": "%"},
                {"label": "Advisory Threshold", "value": 50, "unit": "km/h"},
                {"label": "Warning Threshold", "value": 75, "unit": "km/h"},
                {"label": "Emergency Threshold", "value": 100, "unit": "km/h"},
            ],
            "action_items": action_items,
            "confidence": confidence,
        }

    def _generate_generator_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate generator advisory including wet stacking and cold start guidance."""
        diesel_kw = t.get("diesel_kw", 0)
        temp_c = t.get("temperature_c", -20)
        total_load = t.get("total_load_kw", 200)
        renewable_pct = t.get("renewable_pct", 0)

        # Assume 250 kW rated (default if capacity not in telemetry)
        diesel_capacity = t.get("capacity_diesel_kw", 250)
        load_factor = (diesel_kw / diesel_capacity * 100) if diesel_capacity > 0 else 0
        min_load_pct = 40  # Wet stacking minimum
        min_load_kw = diesel_capacity * 0.40

        # Wet stacking risk assessment
        wet_stacking_risk = diesel_kw > 0 and load_factor < min_load_pct
        cold_start_required = temp_c < -30

        primary_doc = retrieved[0]["document"] if retrieved else {}
        doc_title = primary_doc.get("title", "Wet Stacking Prevention Guide")
        excerpt = retrieved[0]["excerpt"] if retrieved else ""

        answer = (
            f"**Generator Status Assessment** — Per {doc_title}:\n\n"
            f"**Generator Output:** {'ONLINE at ' + str(round(diesel_kw, 1)) + ' kW' if diesel_kw > 5 else 'OFFLINE — renewable + battery covering load'}\n"
            f"**Load Factor:** {load_factor:.1f}% of rated capacity ({diesel_capacity:.0f} kW)\n"
            f"{'⚠️ **WET STACKING RISK:** Load factor ' + str(round(load_factor, 1)) + '% is BELOW 40% minimum. Immediate action required.' if wet_stacking_risk else '✅ Load factor within safe range (≥40%)'}\n\n"
            f"**Wet Stacking Prevention (NCPOR Guide):**\n"
            f"  • Minimum load: **40% of rated = {min_load_kw:.0f} kW** for this generator\n"
            f"  • Current load: {diesel_kw:.1f} kW ({'⚠️ BELOW minimum' if wet_stacking_risk else '✅ Above minimum'})\n"
            f"  • Minimum continuous runtime: 3 hours per start (recommended 8 hours)\n"
            f"  • Signs of wet stacking: black exhaust smoke, oily stack residue, strong fuel smell\n\n"
            f"**Cold Start Guidance:**\n"
            f"  {'🔴 Cold start procedure REQUIRED (temp ' + str(temp_c) + '°C < -30°C):' if cold_start_required else '• Temperature ' + str(round(temp_c, 1)) + '°C — standard cold start protocol applies'}\n"
            f"  {'  1. Coolant preheat: minimum 30-60 min (target 15°C coolant temp)' if cold_start_required else ''}\n"
            f"  {'  2. Oil preheat: minimum 30 min (target 10°C sump temp)' if cold_start_required else ''}\n"
            f"  {'  3. Fuel system: verify no gelling, prime injection pump' if cold_start_required else ''}\n"
            f"  {'  4. Glow plugs: 30 seconds before cranking' if cold_start_required else ''}\n\n"
            f"**Optimal Generator Operation:**\n"
            f"  • Best efficiency range: 60–80% rated load\n"
            f"  • Rotate generators every 48–72 hours for even wear\n"
            f"  • Run waste heat recovery for building heating (saves ~15 kW equivalent)"
        )

        reasoning = (
            f"**Load Factor Calculation:**\n"
            f"Diesel output = {diesel_kw:.1f} kW / Rated capacity = {diesel_capacity:.0f} kW\n"
            f"Load factor = {load_factor:.1f}%\n"
            f"Minimum required = 40% = {min_load_kw:.0f} kW\n"
            f"Status: {'⚠️ BELOW minimum — wet stacking risk active' if wet_stacking_risk else '✅ Within acceptable range'}\n\n"
            f"**Renewable context:**\n"
            f"Current renewable fraction = {renewable_pct:.1f}%\n"
            f"Solar = {t.get('solar_kw', 0):.1f} kW | Wind = {t.get('wind_kw', 0):.1f} kW\n"
            f"If generator running at low load due to high renewables, consider:\n"
            f"  → Switch to smaller generator unit if available\n"
            f"  → Apply resistive load bank to pad load above 40%\n\n"
            f"**Reference:** {excerpt[:300]}"
        )

        action_items = []
        if wet_stacking_risk:
            action_items.append(f"🔴 WET STACKING ALERT: Increase generator load to min {min_load_kw:.0f} kW ({min_load_pct}% rated)")
            action_items.append("⚡ Apply load bank or schedule high-load activities (laundry, water heating) during this run cycle")
            action_items.append("👁️ Monitor exhaust — if black smoke persists, schedule full engine service")
        if diesel_kw == 0 and t.get("battery_soc_pct", 100) < 30:
            action_items.append("⚙️ Start diesel generator — battery approaching minimum reserve")
        if cold_start_required:
            action_items.append("🌡️ Pre-heat coolant and oil for minimum 30 minutes before start attempt")
        if diesel_kw > diesel_capacity * 0.85:
            action_items.append(f"⚠️ Generator near capacity limit ({load_factor:.0f}%). Start second generator in parallel.")

        confidence = 0.94 if retrieved else 0.76

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Diesel Output", "value": round(diesel_kw, 1), "unit": "kW"},
                {"label": "Load Factor", "value": round(load_factor, 1), "unit": "%"},
                {"label": "Min Safe Load", "value": round(min_load_kw, 0), "unit": "kW"},
                {"label": "Temperature", "value": round(temp_c, 1), "unit": "°C"},
                {"label": "Wet Stacking Risk", "value": 1 if wet_stacking_risk else 0, "unit": "bool"},
                {"label": "Renewable Coverage", "value": round(renewable_pct, 1), "unit": "%"},
            ],
            "action_items": action_items,
            "confidence": confidence,
        }

    def _generate_load_shedding_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate load shedding advisory with tier-specific action lists."""
        total_load = t.get("total_load_kw", 200)
        renewable = t.get("solar_kw", 0) + t.get("wind_kw", 0)
        diesel_kw = t.get("diesel_kw", 0)
        soc = t.get("battery_soc_pct", 0)
        fuel_pct = t.get("fuel_level_pct", 0)

        # Estimated power deficit
        deficit = max(0, total_load - renewable - t.get("battery_kw", 0))

        primary_doc = retrieved[0]["document"] if retrieved else {}
        doc_title = primary_doc.get("title", "NCPOR Load Priority Classification")
        excerpt = retrieved[0]["excerpt"] if retrieved else ""

        answer = (
            f"**Load Shedding Assessment** — Per {doc_title}:\n\n"
            f"**Current Load Situation:**\n"
            f"  • Total Station Load: {total_load:.1f} kW\n"
            f"  • Renewable Generation: {renewable:.1f} kW ({t.get('renewable_pct', 0):.1f}% of load)\n"
            f"  • Diesel Generation: {diesel_kw:.1f} kW\n"
            f"  • Battery SOC: {soc:.1f}% | Fuel: {fuel_pct:.1f}%\n\n"
            f"**Three-Tier Priority System (NCPOR EOS-007):**\n\n"
            f"**🔴 TIER 1 — Life Safety (NEVER SHED):** ~40–80 kW\n"
            f"  • Medical bay, emergency comms, fire systems, survival heating\n"
            f"  • Emergency lighting, kitchen minimum, core servers, water treatment\n\n"
            f"**🟡 TIER 2 — Station Operations (Emergency only):** ~60–120 kW\n"
            f"  • Full lab heating (reduce to minimum), scientific instruments\n"
            f"  • Full kitchen, hot water, partial computing cluster, weather monitoring\n\n"
            f"**🟢 TIER 3 — Non-Essential (First to shed):** ~40–90 kW\n"
            f"  • Recreation room, workshop heating, vehicle bay heating\n"
            f"  • Full computing cluster, training rooms, exterior lighting, sauna\n\n"
            f"**Load Shedding Trigger (current status):**\n"
            f"  {'🟢 No shedding required — normal operations' if fuel_pct >= 35 and soc >= 30 else '🟡 Tier 3 voluntary reduction recommended' if fuel_pct >= 20 else '🔴 Enforce Tier 3 + evaluate Tier 2 shedding'}\n\n"
            f"**If maximum shedding applied:**\n"
            f"  Tier 3 OFF → saves ~108 kW\n"
            f"  Tier 2 reduced → saves additional ~88 kW\n"
            f"  Minimum viable load (Tier 1 only) → ~40–65 kW"
        )

        reasoning = (
            f"**Trigger Assessment:**\n"
            f"Fuel level = {fuel_pct:.1f}% | Battery SOC = {soc:.1f}%\n"
            f"• Fuel < 20%? {'YES — Critical fuel conservation' if fuel_pct < 20 else 'No'}\n"
            f"• SOC < 20%? {'YES — Battery emergency' if soc < 20 else 'No'}\n"
            f"• Power deficit? {deficit:.1f} kW\n\n"
            f"**Shedding priority logic:**\n"
            f"Tier 3 first (non-essential, ~108 kW potential)\n"
            f"→ Then Tier 2 if deficit remains\n"
            f"→ Tier 1 maintained at all times (life safety)\n\n"
            f"**Reference:** {excerpt[:300]}"
        )

        action_items = []
        if fuel_pct < 20 or soc < 20:
            action_items.append("🚨 EMERGENCY: Immediately shed ALL Tier 3 loads")
            action_items.append("⚠️ Begin Tier 2 partial shedding — reduce lab heating, computing cluster")
        elif fuel_pct < 35:
            action_items.append("📋 Request voluntary Tier 3 reduction from all station personnel")
            action_items.append("⏱️ Schedule energy-intensive tasks during renewable peak windows")
        else:
            action_items.append("📊 Review Tier 3 loads for voluntary efficiency improvements")
        action_items.append("📋 Ensure all staff briefed on current tier status and personal area responsibilities")

        confidence = 0.93 if retrieved else 0.77

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Total Load", "value": round(total_load, 1), "unit": "kW"},
                {"label": "Renewable Output", "value": round(renewable, 1), "unit": "kW"},
                {"label": "Diesel Output", "value": round(diesel_kw, 1), "unit": "kW"},
                {"label": "Battery SOC", "value": round(soc, 1), "unit": "%"},
                {"label": "Fuel Level", "value": round(fuel_pct, 1), "unit": "%"},
                {"label": "Tier 3 Savings Potential", "value": 108, "unit": "kW"},
            ],
            "action_items": action_items,
            "confidence": confidence,
        }

    def _generate_renewable_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate renewable energy advisory referencing integration guide."""
        solar_kw = t.get("solar_kw", 0)
        wind_kw = t.get("wind_kw", 0)
        renewable_pct = t.get("renewable_pct", 0)
        irradiance = t.get("solar_irradiance_wm2", 0)
        wind_speed = t.get("wind_speed_kmh", 0)
        soc = t.get("battery_soc_pct", 0)
        temp_c = t.get("temperature_c", -20)
        total_load = t.get("total_load_kw", 200)

        primary_doc = retrieved[0]["document"] if retrieved else {}
        doc_title = primary_doc.get("title", "Renewable Energy Integration Guide")
        excerpt = retrieved[0]["excerpt"] if retrieved else ""

        # Solar efficiency note for cold temps
        cold_boost = temp_c < 0  # Panels slightly more efficient in cold

        answer = (
            f"**Renewable Energy Status** — Per {doc_title}:\n\n"
            f"**Current Renewable Generation:**\n"
            f"  ☀️ Solar: {solar_kw:.1f} kW (Irradiance: {irradiance:.0f} W/m²)\n"
            f"  💨 Wind: {wind_kw:.1f} kW (Speed: {wind_speed:.1f} km/h)\n"
            f"  **Total: {solar_kw + wind_kw:.1f} kW = {renewable_pct:.1f}% of {total_load:.1f} kW station load**\n\n"
            f"**Priority Dispatch Status (NCPOR RTG-2024-001):**\n"
            f"  Priority 1 (Solar): {'✅ Dispatching at max' if solar_kw > 0 else '⏸️ Offline (polar night or zero irradiance)'}\n"
            f"  Priority 2 (Wind): {'✅ Dispatching at max' if wind_kw > 0 else '⏸️ Offline (below cut-in or cut-out)' if wind_speed < 10 or wind_speed > 75 else '⚠️ Reduced output'}\n"
            f"  Priority 3 (Battery): {'Discharging' if t.get('battery_kw', 0) > 0 else 'Charging' if t.get('battery_kw', 0) < 0 else 'Idle'} | SOC: {soc:.1f}%\n\n"
            f"**MPPT Settings Note:**\n"
            f"  {'❄️ Cold temperature boost: At ' + str(temp_c) + '°C, panels can exceed rated power by 10–15%. Verify MPPT max voltage set to 110% Voc.' if cold_boost else 'Temperature within normal MPPT operating range'}\n\n"
            f"**Renewable Fraction Targets (NCPOR):**\n"
            f"  Current: {renewable_pct:.1f}% | Maitri target: 35% | Bharati target: 40% | Himadri target: 30%\n"
            f"  Status: {'✅ Meeting minimum target' if renewable_pct >= 25 else '⚠️ Below ATCM recommended minimum (25%)'}\n\n"
            f"**Curtailment Status:**\n"
            f"  {'⚠️ Consider curtailment — battery approaching full SOC' if soc >= 90 else '✅ No curtailment needed — battery absorbing all available renewable'}"
        )

        reasoning = (
            f"**Wind Turbine Analysis:**\n"
            f"Wind speed = {wind_speed:.1f} km/h\n"
            f"  Cut-in: 10 km/h | Rated: 40 km/h | Cut-out: 75 km/h\n"
            f"  Status: {'Within operating range' if 10 <= wind_speed <= 75 else 'Outside operating range'}\n\n"
            f"**Solar Analysis:**\n"
            f"Irradiance = {irradiance:.0f} W/m²\n"
            f"At {irradiance:.0f} W/m² and 80% efficiency, expected yield ≈ {irradiance * 0.8 / 1000 * 100:.1f} kW (100 kWp array)\n\n"
            f"**Reference:** {excerpt[:300]}"
        )

        action_items = []
        if soc >= 90 and (solar_kw + wind_kw) > total_load:
            action_items.append("📉 Battery full + excess renewable: Apply curtailment (solar first, then wind)")
        if wind_speed > 60:
            action_items.append("⚠️ Wind approaching cut-out (75 km/h) — monitor turbine auto-shutdown status")
        if solar_kw < 5 and irradiance > 50:
            action_items.append("🔍 Solar output low despite available irradiance — check for panel snow/ice cover")
        if renewable_pct < 25:
            action_items.append("📋 Renewable fraction below ATCM target — investigate panel/turbine performance")
        if cold_boost:
            action_items.append(f"🌡️ Cold temp ({temp_c:.0f}°C): Verify MPPT max voltage ≥ 110% of standard Voc for cold-boost capture")

        confidence = 0.91 if retrieved else 0.74

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Solar Output", "value": round(solar_kw, 1), "unit": "kW"},
                {"label": "Wind Output", "value": round(wind_kw, 1), "unit": "kW"},
                {"label": "Renewable Fraction", "value": round(renewable_pct, 1), "unit": "%"},
                {"label": "Irradiance", "value": round(irradiance, 0), "unit": "W/m²"},
                {"label": "Wind Speed", "value": round(wind_speed, 1), "unit": "km/h"},
                {"label": "Battery SOC", "value": round(soc, 1), "unit": "%"},
            ],
            "action_items": action_items,
            "confidence": confidence,
        }

    def _generate_environmental_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate environmental / treaty compliance advisory."""
        co2_kg = t.get("co2_emissions_kg", 0)
        diesel_kw = t.get("diesel_kw", 0)
        renewable_pct = t.get("renewable_pct", 0)
        carbon_avoided = t.get("carbon_avoided_kg", 0)

        # Annualize current rate for compliance estimate
        co2_annual_rate_kg = co2_kg * 3600 * 24 * 365  # kg/year at current rate
        co2_annual_tonnes = co2_annual_rate_kg / 1000

        primary_doc = retrieved[0]["document"] if retrieved else {}
        doc_title = primary_doc.get("title", "CO2 Monitoring Requirements")
        excerpt = retrieved[0]["excerpt"] if retrieved else ""

        answer = (
            f"**Environmental & Treaty Compliance Assessment** — Per {doc_title}:\n\n"
            f"**Current Emissions (Real-time):**\n"
            f"  • CO2 from diesel: {co2_kg:.4f} kg/s (current generation rate)\n"
            f"  • Annualized rate: ~{co2_annual_tonnes:.1f} tonnes CO2/year\n"
            f"  • Carbon avoided by renewables: {carbon_avoided:.4f} kg/s\n\n"
            f"**Madrid Protocol — Per-Station Annual CO2 Limits:**\n"
            f"  Maitri:  850 tonnes/year | Status: {'✅ Within limit' if co2_annual_tonnes < 850 else '🔴 EXCEEDS LIMIT'}\n"
            f"  Bharati: 1,200 tonnes/year | Status: {'✅ Within limit' if co2_annual_tonnes < 1200 else '🔴 EXCEEDS LIMIT'}\n"
            f"  Himadri: 320 tonnes/year | Status: {'✅ Within limit' if co2_annual_tonnes < 320 else '🔴 EXCEEDS LIMIT'}\n\n"
            f"**Current Renewable Impact:**\n"
            f"  Renewable fraction: {renewable_pct:.1f}% reducing diesel dependency\n"
            f"  ATCM 2030 target: >25% renewable contribution\n"
            f"  Current status: {'✅ Meeting ATCM target' if renewable_pct >= 25 else '⚠️ Below ATCM recommended 25%'}\n\n"
            f"**Madrid Protocol Key Obligations:**\n"
            f"  • Fuel spills >50L must be reported within 24h to NCPOR\n"
            f"  • Monthly exhaust emissions monitoring (CO, NOx, PM2.5)\n"
            f"  • Double-wall fuel tanks with secondary containment mandatory\n"
            f"  • Annual emissions inventory report to Antarctic Treaty parties"
        )

        reasoning = (
            f"**Emission Calculation:**\n"
            f"CO2 = Diesel consumed × 2.68 kg CO2/L = Diesel kWh × 0.82 kg CO2/kWh\n"
            f"Current diesel = {diesel_kw:.1f} kW → {diesel_kw * 0.82:.3f} kg CO2/hour\n"
            f"Annualized = {diesel_kw * 0.82 * 24 * 365 / 1000:.1f} tonnes CO2/year\n\n"
            f"**Renewable offset value:**\n"
            f"Each kWh from solar/wind avoids 0.82 kg CO2\n"
            f"Current renewable avoidance = {carbon_avoided:.4f} kg CO2/s\n\n"
            f"**Reference:** {excerpt[:300]}"
        )

        action_items = []
        action_items.append("📊 Review monthly emissions log — compare against rolling annual budget")
        if renewable_pct < 25:
            action_items.append("🌱 Increase renewable fraction to meet ATCM 25% target — optimize MPPT settings")
        action_items.append("🔍 Schedule monthly exhaust sensor calibration (CO, NOx, PM2.5)")
        action_items.append("📋 Verify fuel bund/secondary containment inspection is current (monthly check)")

        confidence = 0.89 if retrieved else 0.72

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Current CO2 Rate", "value": round(co2_kg, 4), "unit": "kg/s"},
                {"label": "Projected Annual CO2", "value": round(co2_annual_tonnes, 1), "unit": "tonnes/yr"},
                {"label": "Carbon Avoided", "value": round(carbon_avoided, 4), "unit": "kg/s"},
                {"label": "Renewable Fraction", "value": round(renewable_pct, 1), "unit": "%"},
                {"label": "Maitri CO2 Limit", "value": 850, "unit": "tonnes/yr"},
                {"label": "Bharati CO2 Limit", "value": 1200, "unit": "tonnes/yr"},
            ],
            "action_items": action_items,
            "confidence": confidence,
        }

    def _generate_general_answer(self, query: str, t: dict, retrieved: list) -> dict:
        """Generate a comprehensive overview answer for general/status queries."""
        solar_kw = t.get("solar_kw", 0)
        wind_kw = t.get("wind_kw", 0)
        diesel_kw = t.get("diesel_kw", 0)
        total_load = t.get("total_load_kw", 200)
        soc = t.get("battery_soc_pct", 0)
        fuel_pct = t.get("fuel_level_pct", 0)
        renewable_pct = t.get("renewable_pct", 0)
        temp_c = t.get("temperature_c", -20)
        wind_speed = t.get("wind_speed_kmh", 0)
        co2_kg = t.get("co2_emissions_kg", 0)

        # Overall system health
        risk_flags = []
        if fuel_pct < 20:
            risk_flags.append("🔴 CRITICAL FUEL")
        elif fuel_pct < 35:
            risk_flags.append("🟠 LOW FUEL")
        if soc < 20:
            risk_flags.append("🔴 CRITICAL BATTERY")
        elif soc < 35:
            risk_flags.append("🟠 LOW BATTERY")
        if wind_speed >= 75:
            risk_flags.append("🔴 STORM WARNING")
        elif wind_speed >= 50:
            risk_flags.append("🟡 WIND ADVISORY")
        if temp_c < -35:
            risk_flags.append("🟠 EXTREME COLD")

        overall_status = "🟢 Normal Operations" if not risk_flags else f"⚠️ {', '.join(risk_flags)}"

        sources_text = "\n".join([
            f"  • {r['document']['title']} (relevance: {r['relevance_score']:.1f})"
            for r in retrieved
        ]) if retrieved else "  • No specific documents retrieved"

        answer = (
            f"**Polar Station Energy Overview**\n\n"
            f"**Overall Status: {overall_status}**\n\n"
            f"**⚡ Power Generation:**\n"
            f"  ☀️ Solar: {solar_kw:.1f} kW | 💨 Wind: {wind_kw:.1f} kW\n"
            f"  🔋 Battery: {'Discharging ' + str(abs(t.get('battery_kw', 0))) + ' kW' if t.get('battery_kw', 0) > 0 else 'Charging ' + str(abs(t.get('battery_kw', 0))) + ' kW' if t.get('battery_kw', 0) < 0 else 'Idle'}\n"
            f"  ⚙️ Diesel: {diesel_kw:.1f} kW\n"
            f"  **🔌 Total Load: {total_load:.1f} kW | Renewable: {renewable_pct:.1f}%**\n\n"
            f"**📊 Storage & Fuel:**\n"
            f"  Battery SOC: {soc:.1f}% | Fuel Level: {fuel_pct:.1f}%\n\n"
            f"**🌡️ Weather:**\n"
            f"  Temperature: {temp_c:.1f}°C | Wind: {wind_speed:.1f} km/h\n"
            f"  Conditions: {t.get('conditions', 'Unknown')}\n\n"
            f"**🌿 Environmental:**\n"
            f"  CO2 rate: {co2_kg:.3f} kg/s | Carbon avoided: {t.get('carbon_avoided_kg', 0):.3f} kg/s\n\n"
            f"**📚 Relevant Knowledge Base Documents:**\n"
            f"{sources_text}\n\n"
            f"Ask specific questions about: fuel levels, battery status, blizzard response, "
            f"generator maintenance, load shedding, renewable integration, or environmental compliance."
        )

        reasoning = (
            f"Comprehensive telemetry analysis for current station state.\n"
            f"All {self._kb.document_count} knowledge base documents available covering:\n"
            f"{', '.join(self._kb.get_all_categories())}\n\n"
            f"No single domain strongly matched the query — providing full system overview. "
            f"For targeted advice, specify a domain (fuel, battery, generator, blizzard, etc.)"
        )

        action_items = []
        if risk_flags:
            action_items.append(f"⚠️ Address flagged risks immediately: {', '.join(risk_flags)}")
        else:
            action_items.append("✅ System operating normally — continue routine monitoring")
        action_items.append("📋 Run daily energy audit: compare renewable fraction vs. station target")
        action_items.append("🔍 Review NCPOR SOPs relevant to current conditions")

        return {
            "answer": answer,
            "reasoning": reasoning,
            "key_metrics": [
                {"label": "Total Load", "value": round(total_load, 1), "unit": "kW"},
                {"label": "Solar Output", "value": round(solar_kw, 1), "unit": "kW"},
                {"label": "Wind Output", "value": round(wind_kw, 1), "unit": "kW"},
                {"label": "Diesel Output", "value": round(diesel_kw, 1), "unit": "kW"},
                {"label": "Battery SOC", "value": round(soc, 1), "unit": "%"},
                {"label": "Fuel Level", "value": round(fuel_pct, 1), "unit": "%"},
                {"label": "Renewable %", "value": round(renewable_pct, 1), "unit": "%"},
                {"label": "Temperature", "value": round(temp_c, 1), "unit": "°C"},
            ],
            "action_items": action_items,
            "confidence": 0.80,
        }
