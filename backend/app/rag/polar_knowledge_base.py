"""
Polar Station Knowledge Base for RAG System
============================================
Simulates a vector knowledge base using keyword/semantic scoring.
No external vector DB required — all knowledge is embedded as structured
documents covering NCPOR SOPs, Antarctic Treaty obligations, equipment
manuals, and operational guidelines for Maitri, Bharati, and Himadri stations.

Usage:
    kb = PolarKnowledgeBase()
    results = kb.retrieve("how to handle blizzard emergency", top_k=3)
"""

import re
import math
from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# KNOWLEDGE DOCUMENT CORPUS
# Each document: {id, title, category, content, keywords, source}
# ─────────────────────────────────────────────────────────────────────────────

KNOWLEDGE_DOCUMENTS = [
    # ── 1. Blizzard Emergency Protocol ──────────────────────────────────────
    {
        "id": "SOP-4.1",
        "title": "NCPOR SOP 4.1 — Blizzard Emergency Protocol",
        "category": "emergency",
        "content": """
NCPOR STANDARD OPERATING PROCEDURE 4.1
BLIZZARD EMERGENCY PROTOCOL — Maitri/Bharati Antarctic Stations

WIND SPEED THRESHOLDS AND ALERT LEVELS
---------------------------------------
• ADVISORY (Yellow):  Wind ≥ 50 km/h sustained for 10+ minutes
  → Pre-position fuel and check generator oil levels
  → Notify all personnel of incoming conditions
  → Verify satellite communication systems operational

• WARNING (Orange):   Wind ≥ 75 km/h or visibility < 200 m
  → Restrict all outdoor movement except emergency personnel
  → Switch to Diesel Generator #1 (primary) as sole power source
  → Activate battery backup precharge to 95% SOC
  → Increase heating setpoint to +2°C above normal

• EMERGENCY (Red):    Wind ≥ 100 km/h or visibility < 50 m (whiteout)
  → MANDATORY LOAD SHEDDING — Immediate implementation
  → Tier-3 loads OFF: recreation room, workshop heating, cargo heating
  → Tier-2 loads reduced: lab computing cluster to 50% capacity
  → Tier-1 maintained: life support heating, communication, medical, kitchen
  → Generator load target: maintain between 40–70% rated capacity
  → Deploy second generator if primary load > 80% rated capacity

GENERATOR PRIORITY DURING BLIZZARD
------------------------------------
Step 1: Start Diesel Generator #1 (250 kW rated)
        Pre-heat oil for 15 min if temp < -20°C before start
Step 2: Disconnect solar array (ice/snow accumulation risk)
        Wind turbines auto-shutdown above 75 km/h cut-out speed
Step 3: Battery bank to float charge mode — do not deplete below 40% SOC
Step 4: If blizzard exceeds 8 hours, start Generator #2 in hot-standby

LOAD SHEDDING SEQUENCE (Emergency Red)
----------------------------------------
1. Non-essential lighting (save ~8 kW)
2. Workshop electric heating (save ~15 kW)
3. Vehicle bay heating (save ~20 kW)
4. Ice melting plant — switch to minimum flow (save ~12 kW)
5. Scientific instrument heating (non-critical instruments, save ~10 kW)
6. Computing cluster reduction to essential nodes only (save ~25 kW)
Total potential savings: ~90 kW (≈35–40% of normal load)

POST-BLIZZARD RESTORATION
---------------------------
• Restore loads in reverse order once wind drops below 40 km/h for 30 min
• Inspect solar panels before reconnecting to array
• Turbine restart requires wind between 10–40 km/h sustained
• Document all load-shedding events in Station Log Book
        """,
        "keywords": [
            "blizzard", "storm", "emergency", "wind speed", "whiteout",
            "load shedding", "generator priority", "evacuation", "wind threshold",
            "advisory", "warning", "red alert", "visibility", "safety",
            "power outage", "blizzard protocol", "polar storm"
        ],
        "source": "NCPOR SOP 4.1, Rev 3.2, 2024"
    },

    # ── 2. Polar Night Energy Conservation ──────────────────────────────────
    {
        "id": "SOP-4.2",
        "title": "NCPOR SOP 4.2 — Polar Night Energy Conservation Protocol",
        "category": "conservation",
        "content": """
NCPOR STANDARD OPERATING PROCEDURE 4.2
POLAR NIGHT ENERGY CONSERVATION — Antarctic Winter Operations

POLAR NIGHT DEFINITION
-----------------------
For Maitri Station (lat -70.7°S): May–August (≈120 days of no useful solar)
For Bharati Station (lat -69.4°S): June–July (≈60 days no solar, reduced May/Aug)
For Himadri Station (lat 78.9°N):  November–January (Arctic polar night)

TARGET: 30% REDUCTION IN ENERGY CONSUMPTION
---------------------------------------------
Polar night eliminates all solar generation (typically 15–40% of load).
Mandatory conservation target: reduce total consumption by 30% vs. summer baseline.

HEATING PRIORITY HIERARCHY (Polar Night)
-----------------------------------------
Priority 1 — Life Safety (Never Reduced):
  • Personnel sleeping quarters: min 18°C
  • Medical bay: min 22°C
  • Emergency equipment room: min 15°C
  • Fuel storage building: min 5°C (prevent gelling)

Priority 2 — Station Operations (Reduced 10%):
  • Main operations room: setpoint reduced from 20°C to 18°C
  • Dining hall: setpoint reduced from 22°C to 20°C
  • Communication center: maintained at 20°C

Priority 3 — Research Activities (Reduced 30%):
  • Laboratory spaces: setpoint from 20°C to 17°C during non-work hours
  • Instrument rooms: maintain minimum 10°C for equipment safety
  • Data servers: air-cooled but minimum ambient 15°C

Priority 4 — Non-Essential (Reduced 50%+):
  • Gym/Recreation: heated only 2 hours/day (18:00–20:00)
  • Workshop: heated on-demand, not continuously
  • Storage areas: frost prevention only (5°C min)

GENERATOR SCHEDULE OPTIMIZATION (Polar Night)
----------------------------------------------
• Operate diesel generators at 60–80% rated load for peak efficiency
  (Avoid < 40% load — wet stacking risk; avoid > 85% — overload risk)
• Schedule high-power loads (laundry, water heating) during 10:00–16:00
• Implement 2-generator rotation: alternate every 48h for even wear
• Waste heat recovery from generators for building heating (saves ~15 kW)

30% CONSUMPTION REDUCTION CHECKLIST
--------------------------------------
☐ All LED lighting transitions complete
☐ Heating setpoints adjusted per priority hierarchy
☐ Non-essential equipment on programmable timers
☐ Computing cluster load reduced to active research only
☐ Hot water heating on 6-hour cycle (not continuous)
☐ Weekly energy audit and comparison to baseline
☐ Wind generation priority — maximise capture during polar night
        """,
        "keywords": [
            "polar night", "winter", "energy conservation", "30%",
            "heating priority", "consumption reduction", "load management",
            "arctic winter", "antarctic winter", "darkness", "no solar",
            "conservation protocol", "seasonal", "generator schedule"
        ],
        "source": "NCPOR SOP 4.2, Rev 2.1, 2024"
    },

    # ── 3. Fuel Reserve Management ──────────────────────────────────────────
    {
        "id": "SOP-7.3",
        "title": "NCPOR SOP 7.3 — Fuel Reserve Management",
        "category": "fuel",
        "content": """
NCPOR STANDARD OPERATING PROCEDURE 7.3
FUEL RESERVE MANAGEMENT — All Antarctic/Arctic Stations

FUEL THRESHOLD LEVELS
-----------------------
■ OPERATIONAL (Green):   Fuel level > 60%
  → Normal operations, all non-critical systems available
  → Resupply planning on annual schedule

■ ADVISORY (Yellow):     Fuel level 35%–60%
  → Begin resupply planning immediately
  → Report fuel status in weekly station report
  → Review and reduce non-essential diesel usage

■ WARNING (Orange):      Fuel level 20%–35%
  → Activate fuel conservation protocol (10% demand reduction)
  → Notify NCPOR Headquarters immediately
  → Expedite resupply logistics
  → Fuel runway calculation required (see formula below)

■ CRITICAL (Red):        Fuel level < 20%
  → EMERGENCY RESUPPLY REQUEST — immediate
  → Reduce station to essential operations only
  → Activate all renewable energy maximization
  → Consider partial station hibernation if level drops below 15%

FUEL RUNWAY CALCULATION
------------------------
Fuel Runway (days) = (Fuel Level % × Tank Capacity L) / (Daily Consumption L/day)

Daily Consumption = Avg Diesel kW × 0.25 L/kWh × 24 h

Example: 25% fuel, 50,000 L tank, 150 kW diesel avg:
  Available = 0.25 × 50,000 = 12,500 L
  Daily use = 150 × 0.25 × 24 = 900 L/day
  Runway = 12,500 / 900 = 13.9 days

RESUPPLY LEAD TIMES
--------------------
• Maitri (Antarctica): 45–90 days sea voyage + 7 days port loading
  → Order when fuel < 35% (minimum 52-day notice required)
• Bharati (Antarctica): 45–90 days sea voyage + 7 days port loading
  → Order when fuel < 35%
• Himadri (Svalbard/Arctic): 5–14 days by ship or air
  → Order when fuel < 20% (15-day notice sufficient)

FUEL QUALITY MONITORING
------------------------
• Test diesel cetane number every 90 days
• Check for water contamination monthly (fuel test kit)
• Antarctic-grade diesel (AVTUR/JET A-1 below -40°C pour point required)
• Fuel additive injection mandatory below -25°C ambient

FUEL STORAGE SAFETY
--------------------
• Secondary containment berm required (110% of tank volume)
• Fuel building temperature: maintain 2–10°C (prevent gelling/freezing)
• Tank venting — prevent ice plug formation at vent outlets
• Monthly level checks with redundant dip gauge and electronic sensor
        """,
        "keywords": [
            "fuel", "diesel", "reserve", "fuel level", "critical",
            "20%", "35%", "threshold", "resupply", "fuel runway",
            "days remaining", "tank", "fuel management", "refuel",
            "consumption rate", "logistic", "fuel warning", "fuel emergency"
        ],
        "source": "NCPOR SOP 7.3, Rev 4.0, 2024"
    },

    # ── 4. Antarctic Treaty — Madrid Protocol Art 8 ─────────────────────────
    {
        "id": "TREATY-MAD-ART8",
        "title": "Antarctic Treaty — Protocol on Environmental Protection (Madrid Protocol) Article 8",
        "category": "environmental",
        "content": """
PROTOCOL ON ENVIRONMENTAL PROTECTION TO THE ANTARCTIC TREATY
MADRID PROTOCOL — ARTICLE 8: ENVIRONMENTAL IMPACT ASSESSMENT
Adopted: 1991, In Force: 1998

ARTICLE 8 — ENVIRONMENTAL IMPACT ASSESSMENT (EIA)
---------------------------------------------------
All activities in Antarctica (including energy operations at research stations)
require Environmental Impact Assessment. Three tiers:

TIER 1 — PRELIMINARY ASSESSMENT
  Applies to: Routine operations with minor potential impact
  Examples: Normal diesel generator operation within limits
  Review: Station commander authorization

TIER 2 — INITIAL ENVIRONMENTAL EVALUATION (IEE)
  Applies to: Activities with minor to moderate impact
  Examples: New generator installation, solar array expansion
  Review: National Antarctic program authorization

TIER 3 — COMPREHENSIVE ENVIRONMENTAL EVALUATION (CEE)
  Applies to: Activities with potentially significant impact
  Examples: Major fuel storage expansion, new station construction
  Review: Antarctic Treaty Consultative Meeting (ATCM) approval

FUEL SPILL PREVENTION REQUIREMENTS
-------------------------------------
Article 15 (Emergency Response) obligations:
• All fuel transfers must use secondary containment drip trays
• Emergency fuel spill response equipment must be accessible within 2 min
• All fuel tanks must have double-wall construction or lined bund walls
• Automatic fuel shutoff on spill detection required (electronic sensors)
• Any spill > 50 L must be reported to NCPOR within 24 hours
• Any spill > 200 L requires formal incident report to treaty parties

EMISSIONS MONITORING REQUIREMENTS
-----------------------------------
Annex III — Waste Management:
• All combustion emissions from diesel generators must be monitored
• Diesel generators must be equipped with exhaust particulate filters
• Black smoke emission prohibited — indicates incomplete combustion
• Monthly CO, NOx, particulate matter (PM2.5) readings required

Annual Station CO2 Budget (per Annex III obligations):
  Maitri Station:   Max 850 tonnes CO2-equivalent per year
  Bharati Station:  Max 1,200 tonnes CO2-equivalent per year
  Himadri Station:  Max 320 tonnes CO2-equivalent per year

RENEWABLE ENERGY PRIORITY (PROTOCOL GUIDANCE)
----------------------------------------------
• Stations should prioritize renewable energy to minimize emissions
• Solar and wind integration is encouraged to reduce diesel dependency
• Documentation of renewable percentage must be included in annual reports
• Target: >25% renewable contribution by 2030 (ATCM Resolution 5, 2023)
        """,
        "keywords": [
            "environmental", "treaty", "madrid protocol", "CO2", "emissions",
            "fuel spill", "environmental impact", "assessment", "EIA",
            "monitoring", "carbon", "pollution", "regulations", "compliance",
            "antarctic treaty", "annex III", "waste", "renewable energy obligation"
        ],
        "source": "Antarctic Treaty Protocol on Environmental Protection, 1991 (Madrid Protocol)"
    },

    # ── 5. Wet Stacking Prevention ───────────────────────────────────────────
    {
        "id": "MAINT-GEN-001",
        "title": "Diesel Generator Wet Stacking Prevention Guide",
        "category": "maintenance",
        "content": """
DIESEL GENERATOR WET STACKING PREVENTION GUIDE
Polar Station Operations — Engine Health Protocol

WHAT IS WET STACKING?
-----------------------
Wet stacking occurs when a diesel engine operates at very low load (typically
< 30–40% of rated capacity) for extended periods. Unburned fuel and oil
accumulate in the exhaust system, causing:
• Black or dark grey exhaust smoke
• Excessive soot/oil deposits in exhaust stack and muffler
• Carbon buildup on cylinder liners, rings, and exhaust valves
• Reduced engine efficiency and increased fuel consumption
• Potential catastrophic engine damage if unaddressed

MINIMUM LOAD REQUIREMENT
--------------------------
■ CRITICAL RULE: Diesel generators at polar stations must operate at
  minimum 40% of rated capacity at all times during continuous run.

  Example: 250 kW rated generator → minimum 100 kW load required
  Example: 150 kW rated generator → minimum 60 kW load required

If available load drops below 40%:
  Option A: Shed excess renewable generation (curtailment) and use diesel
  Option B: Apply dummy/resistive load bank to bring total to 40%
  Option C: Switch to smaller generator (if available) with proper minimum load

MINIMUM RUNTIME REQUIREMENTS
------------------------------
• Each generator must run continuously for minimum 3 hours per start
  (prevents thermal cycling damage and wet stacking buildup)
• Minimum 8-hour run cycle recommended for polar conditions
• If emergency start is required, maintain 3-hour minimum post-startup run
• Generator rotation: alternate generators every 48–72 hours for even wear

SIGNS OF WET STACKING
----------------------
Visual indicators:
• Black or dark smoke from exhaust (especially at startup or load change)
• Oily residue dripping from exhaust stack outlet
• Strong unburned fuel smell in generator room
• Fuel dilution in engine crankcase oil (oil level rises)

Instrument indicators:
• Exhaust temperature below 200°C at rated load (should be 350–450°C)
• Elevated crankcase pressure
• High fuel consumption with low power output

WET STACKING REMEDIATION
-------------------------
Step 1: Increase generator load to 70–80% rated capacity for 2–3 hours
        (connect load bank or schedule high-load activities)
Step 2: Monitor exhaust — should clear to light grey/colorless within 1 hour
Step 3: If smoke persists > 4 hours at full load → full engine service required
Step 4: Document event and corrective action in maintenance log

POLAR-SPECIFIC GUIDANCE
------------------------
• Cold temperatures (-30°C+) increase wet stacking risk at marginal loads
• Pre-heat generator coolant to 50°C before start in extreme cold
• Do NOT run generator at < 25% load during polar night operations
• Battery storage can buffer loads to keep generator in optimal range
        """,
        "keywords": [
            "wet stacking", "generator", "diesel", "load", "minimum load",
            "40%", "runtime", "3 hours", "engine", "exhaust", "smoke",
            "maintenance", "genset", "black smoke", "generator health",
            "diesel engine", "combustion", "load bank"
        ],
        "source": "NCPOR Generator Maintenance Manual, Section 3.4 (2023)"
    },

    # ── 6. Lithium Battery Cold Weather Operation ────────────────────────────
    {
        "id": "BATT-CW-002",
        "title": "Lithium Battery Cold Weather Operation Guide",
        "category": "battery",
        "content": """
LITHIUM BATTERY COLD WEATHER OPERATION GUIDE
Polar Research Station Energy Storage Systems

CRITICAL TEMPERATURE LIMITS
------------------------------
■ Charging:
  • Minimum charging temperature: 0°C (charging below 0°C causes
    lithium plating on anode — irreversible capacity damage and safety risk)
  • Maximum charging temperature: 45°C
  • Optimal charging temperature: 15–30°C
  • SAFETY LOCK: BMS (Battery Management System) must prevent charging below 0°C

■ Discharging:
  • Minimum discharge temperature: -20°C (reduced performance but safe)
  • Maximum discharge temperature: 60°C
  • Recommended minimum for full rated discharge: -10°C

CAPACITY DERATING TABLE (Temperature vs. Available Capacity)
-------------------------------------------------------------
Temperature (°C) | Available Capacity | Max Continuous C-Rate
-----------------+--------------------+----------------------
    +25°C        |      100%          |       1.0 C
    +15°C        |       98%          |       1.0 C
     +5°C        |       95%          |       0.8 C
      0°C        |       90%          |       0.7 C
    -10°C        |       78%          |       0.5 C
    -20°C        |       62%          |       0.3 C
    -30°C        |       45%          |       0.2 C
    -40°C        |       25%          |       0.1 C (emergency only)

Example: 500 kWh battery at -20°C → effective capacity = 310 kWh
         400 kWh battery at -10°C → effective capacity = 312 kWh

STATE OF CHARGE MANAGEMENT IN COLD
-------------------------------------
• Do NOT charge to above 90% SOC in temperatures below -10°C
  (reduces lithium plating risk at high state of charge + cold temp)
• Maintain minimum 30% SOC at all times for cold restart capability
• Target operating SOC window: 30%–85% in polar winter conditions
• SOC accuracy: BMS estimates ±5% at -20°C, ±10% at -30°C

BATTERY HEATING SYSTEM (Heating Blanket Specifications)
---------------------------------------------------------
• Electric heating blankets: 48V DC, 2 kW per module (6 modules standard)
  Total heating power: 12 kW
• Activation threshold: automatically engages below 5°C battery internal temp
• Target pre-heat temperature: 10°C before charging permitted
• Pre-heat time: ~45 minutes in -20°C ambient conditions
• Heating power source: prioritize from grid (not battery self-drain)

BATTERY ROOM REQUIREMENTS
---------------------------
• Minimum room temperature: 5°C (battery room insulation mandatory)
• Recommended temperature: 10–20°C for optimal cell performance
• Ventilation: 6 air changes/hour minimum (hydrogen venting safety)
• Fire suppression: CO2 system with automatic activation + manual override
        """,
        "keywords": [
            "battery", "lithium", "cold weather", "temperature", "charging",
            "0°C", "SOC", "capacity", "derating", "heating blanket",
            "BMS", "lithium plating", "cold temperature", "capacity loss",
            "battery storage", "polar", "cold start", "warming"
        ],
        "source": "NCPOR Battery Systems Technical Manual, Rev 2.3 (2024)"
    },

    # ── 7. Maitri Station Power System Manual ───────────────────────────────
    {
        "id": "MAITRI-PWR-001",
        "title": "Maitri Station Power System Manual — Dronning Maud Land, Antarctica",
        "category": "station_manual",
        "content": """
MAITRI RESEARCH STATION — POWER SYSTEM MANUAL
Indian Station, Dronning Maud Land, Antarctica (70°45'S, 11°44'E)
Operated by: National Centre for Polar and Ocean Research (NCPOR)

STATION OVERVIEW
-----------------
• Established: 1988 | Elevation: 170 m above sea level
• Operational Status: Year-round (summer team: ~65, winter team: ~25)
• Design Load: 300 kW peak, 180 kW winter average
• Annual Energy Consumption: ~1,800 MWh

POWER GENERATION SYSTEMS
--------------------------
Primary Diesel Generators:
  Generator #1 (G1): Cummins KTA50-G8, 1,250 kVA (1,000 kW) — Main
  Generator #2 (G2): Cummins QSK60-G4, 900 kVA (720 kW) — Backup
  Generator #3 (G3): Cummins C250-D5, 250 kVA (200 kW) — Emergency

  Operating mode: Typically G3 for winter base load, G1 for summer peak
  Fuel type: EN590 Arctic diesel / Jet-A1 (pour point -60°C)

Solar PV Array:
  Total capacity: 100 kWp (400 × 250 W polycrystalline panels)
  Array area: 650 m² (roof-mounted on main building and satellite structures)
  Inverter: SMA Sunny Tripower (3-phase, 100 kW)
  Annual yield: ~70 MWh (usable only Oct–Mar)
  Peak irradiance season: November–January (midnight sun)

Wind Turbines:
  Turbine #1: Enercon E-33 (350 kW rated) — Primary
  Turbine #2: Enercon E-33 (350 kW rated) — Backup/synchronised
  Combined wind capacity: 700 kW (derated to 350 kW operational limit)
  Cut-in speed: 3 m/s (10.8 km/h)
  Rated speed: 13 m/s (46.8 km/h)
  Cut-out speed: 28 m/s (100.8 km/h)

Battery Energy Storage System (BESS):
  Technology: LiFePO4 (Lithium Iron Phosphate)
  Total capacity: 500 kWh
  Usable capacity: 450 kWh (at 20°C ambient)
  Max charge rate: 125 kW (C/4 rate)
  Max discharge rate: 250 kW (C/2 rate)
  Cycle life: 4,000 cycles at 80% DoD
  Battery room temperature: maintained at 10–18°C

FUEL STORAGE
-------------
Main tank: 50,000 L (HDPE double-wall tank, underground)
Day tank: 2,000 L (gravity-feed to generators)
Emergency reserve: 5,000 L (sealed IBC containers)
Total capacity: 57,000 L

DISTRIBUTION SYSTEM
---------------------
Main switchboard: 415V, 3-phase, 50 Hz, 1,600A busbar
Distribution voltage: 415V/240V (TN-S system)
Emergency circuit: 32A, feeds life-safety loads only
        """,
        "keywords": [
            "Maitri", "maitri station", "antarctic", "power system",
            "generator", "solar", "wind", "battery", "capacity",
            "diesel", "fuel", "LiFePO4", "Cummins", "Enercon",
            "India", "NCPOR", "Antarctic station", "power manual"
        ],
        "source": "Maitri Station Technical Manual, NCPOR-MTR-2024-003"
    },

    # ── 8. Bharati Station Power System Manual ───────────────────────────────
    {
        "id": "BHARATI-PWR-001",
        "title": "Bharati Station Power System Manual — Larsemann Hills, Antarctica",
        "category": "station_manual",
        "content": """
BHARATI RESEARCH STATION — POWER SYSTEM MANUAL
Indian Station, Larsemann Hills, East Antarctica (69°24'S, 76°11'E)
Operated by: National Centre for Polar and Ocean Research (NCPOR)

STATION OVERVIEW
-----------------
• Established: 2012 | Elevation: 50–120 m
• Operational Status: Year-round (summer: ~47, winter: ~23)
• Design Load: 380 kW peak, 220 kW winter average
• Annual Energy Consumption: ~2,100 MWh
• Modern integrated energy management system

POWER GENERATION SYSTEMS
--------------------------
Primary Diesel Generators (pre-installed, insulated container modules):
  Generator Set A: 2 × Kohler 250ROZJ (250 kW each) — parallel operation
  Generator Set B: 1 × Kohler 400ROZJ (400 kW) — peak/backup
  Total diesel capacity: 900 kW (installed); operated at 300–500 kW max

Solar PV Array:
  Total capacity: 150 kWp (modern bifacial mono-crystalline panels)
  Array area: 900 m² (south-facing, 15° tilt optimized for summer angle)
  Bifacial gain: +8% from snow albedo reflection
  Annual yield: ~110 MWh (Oct–Mar operational)
  MPPT inverters: Fronius Symo 150kW-3-phase, configurable curtailment

Wind System:
  Turbine: 2 × Northern Power 100 kW (direct-drive permanent magnet)
  Total wind capacity: 200 kW
  Designed for Antarctic wind patterns (katabatic winds)
  Remote-operated pitch control for storm protection

Battery Energy Storage System:
  Technology: Samsung SDI NMC cells, modular rack system
  Total capacity: 800 kWh (upgrade from original 500 kWh)
  Usable: 720 kWh (10–90% SOC operating window)
  Max power: 400 kW charge/discharge
  Battery room: actively heated to 15°C minimum

FUEL STORAGE
-------------
Primary tank: 80,000 L (steel double-walled, bunded)
IBC emergency: 10,000 L in 25 × 400 L containers
Total: 90,000 L capacity (largest Indian polar fuel depot)

ENERGY MANAGEMENT SYSTEM
--------------------------
• Integrated SCADA system: Schneider Electric EcoStruxure
• Real-time monitoring: 1-second telemetry on all generation/load circuits
• Automatic load shedding: programmatic relay control for 48 load circuits
• Renewable forecasting: 24-hour ahead solar/wind prediction model
        """,
        "keywords": [
            "Bharati", "bharati station", "antarctic", "larsemann hills",
            "power system", "generator", "solar", "wind", "battery", "800 kWh",
            "NMC", "Kohler", "Fronius", "India", "NCPOR", "SCADA",
            "renewable", "station manual", "east antarctica"
        ],
        "source": "Bharati Station Technical Manual, NCPOR-BHR-2024-007"
    },

    # ── 9. Himadri Arctic Station Manual ─────────────────────────────────────
    {
        "id": "HIMADRI-PWR-001",
        "title": "Himadri Arctic Station Manual — Ny-Ålesund, Svalbard",
        "category": "station_manual",
        "content": """
HIMADRI RESEARCH STATION — POWER AND SYSTEMS MANUAL
Indian Arctic Station, Ny-Ålesund, Svalbard, Norway (78°55'N, 11°56'E)
Operated by: National Centre for Polar and Ocean Research (NCPOR)

STATION OVERVIEW
-----------------
• Established: 2008 | Elevation: 8 m above sea level
• Operational Status: Year-round (summer: ~16, winter: ~6–8)
• Design Load: 80 kW peak, 45 kW winter average
• Annual Energy Consumption: ~420 MWh (smaller station)

UNIQUE CHARACTERISTICS
-----------------------
• Located within Ny-Ålesund research community (12+ nations)
• Shares community power grid managed by Kings Bay AS (coal + renewables)
• Station has independent diesel backup capability
• Arctic environment: milder than Antarctica but sea ice and fog common
• Polar night: November–January (63 days of continuous darkness)
• Midnight sun: April–August (strong solar potential)

POWER SYSTEMS
--------------
Connection to Kings Bay Community Grid:
  Grid supply: 400V, 3-phase, 50 Hz (from Kings Bay power plant)
  Normal supply: 60–80 kW capacity allocation
  Grid reliability: 99.2% uptime (backup coal plant on standby)

Station Backup Generator:
  Generator: Volvo Penta D16 MG, 100 kW
  Fuel: Arctic-grade diesel (stored on-site)
  Fuel storage: 8,000 L tank (primary) + 2,000 L emergency
  Typical use: <5% of operating hours (community grid primary)

Local Renewable Generation:
  Solar PV: 30 kWp (rooftop, east-west split array for morning/afternoon)
  Wind: Community wind resources (Kings Bay operated, ~15% contribution)
  Annual solar yield: ~25 MWh (April–August viable)

Battery Backup:
  Technology: VRLA AGM (Valve Regulated Lead Acid)
  Capacity: 120 kWh (UPS-grade, for community grid outages)
  Upgrade planned: 200 kWh LiFePO4 (2025 budget)

ARCTIC-SPECIFIC ENERGY CONSIDERATIONS
---------------------------------------
• Sea freight: Svalbard accessible year-round from mainland Norway
• Resupply: Much shorter lead time vs. Antarctica (5–14 days max)
• Temperature range: -25°C (winter) to +10°C (summer)
• Wind patterns: Katabatic winds from glaciers, strong and consistent
• CO2 emission limit: 320 tonnes/year under Kings Bay environmental plan
        """,
        "keywords": [
            "Himadri", "himadri station", "arctic", "svalbard", "ny-alesund",
            "Kings Bay", "power", "backup generator", "solar", "wind",
            "India", "NCPOR", "grid", "arctic station", "Norwegian",
            "polar night", "midnight sun"
        ],
        "source": "Himadri Station Operations Manual, NCPOR-HIM-2024-002"
    },

    # ── 10. Emergency Generator Startup Procedure ────────────────────────────
    {
        "id": "OPS-GEN-COLD-START",
        "title": "Emergency Generator Startup Procedure — Cold Start Below −30°C",
        "category": "operations",
        "content": """
EMERGENCY GENERATOR COLD START PROCEDURE
Polar Operations — Temperature Below −30°C

⚠️ WARNING: Attempting to start a diesel generator below −30°C without
proper preheating can cause catastrophic engine damage (cracked block,
seized pistons, fuel system failure).

MANDATORY PRE-HEATING REQUIREMENTS
------------------------------------
Before ANY start attempt below −30°C, the following must be confirmed:

Step 1 — COOLANT PREHEATING (30–60 min minimum)
  • Activate electric coolant immersion heater (if fitted): 2–5 kW element
  • Target coolant temperature: minimum +15°C before start
  • Verify coolant heater operation via temperature gauge
  • If no coolant heater: portable diesel-fired air heater directed at radiator

Step 2 — OIL PREHEATING (30 min minimum)
  • Activate engine oil immersion heater (if fitted)
  • Target oil sump temperature: minimum +10°C
  • Use multi-viscosity arctic-grade oil: SAE 0W-40 synthetic
  • Check oil level (cold oil may appear low — do not overfill)

Step 3 — FUEL SYSTEM VERIFICATION
  • Verify fuel filter not iced/gelled (replace arctic filter if needed)
  • Check fuel flow from day tank to injection system
  • Prime injection pump manually if system has been cold for >12 hours
  • Fuel heater element: must reach 20°C fuel supply temperature

Step 4 — BATTERY CHECK
  • Engine start batteries: check voltage — min 12.2V (12V) or 24.4V (24V)
  • If voltage low: warm batteries in heated space for 30 min before charging
  • Lithium start batteries: may refuse to accept charge below 0°C

STARTUP SEQUENCE (After Pre-heating)
--------------------------------------
1. Open fuel isolation valve (day tank to engine)
2. Set throttle to cold-start position (if manual throttle fitted)
3. Engage glow plugs / block heater — hold for 30 seconds
4. Crank engine — maximum 10 seconds continuous cranking
5. If no start: wait 60 seconds, repeat up to 3 attempts
6. After start: idle at 50% load for minimum 15 minutes to warm up
7. Gradually increase to operating load over 5–10 minutes
8. Verify oil pressure within 10 seconds of start (> 2.5 bar)
9. Verify coolant temperature rising within 5 minutes

POST-START MONITORING
----------------------
• First 30 minutes: monitor exhaust temperature (should reach 250°C+)
• Check for abnormal smoke: white = water/coolant, black = fuel-rich
• Monitor battery charge voltage: should be 13.8–14.4V (12V system)
• Record start time, pre-heat duration, and oil/coolant temps in log
        """,
        "keywords": [
            "emergency start", "cold start", "generator startup", "-30°C",
            "cold weather", "preheating", "engine", "startup procedure",
            "generator", "diesel", "oil heater", "coolant", "glow plug",
            "startup sequence", "extreme cold", "polar startup"
        ],
        "source": "NCPOR Generator Operations Manual, Section 5.2 (Emergency Procedures)"
    },

    # ── 11. Load Priority Classification ─────────────────────────────────────
    {
        "id": "OPS-LOAD-PRI-001",
        "title": "Load Priority Classification — Polar Station Tier System",
        "category": "load_management",
        "content": """
POLAR STATION LOAD PRIORITY CLASSIFICATION
NCPOR Electrical Operations Standard — All Stations

TIER CLASSIFICATION OVERVIEW
------------------------------
Loads are classified into three tiers based on criticality to life safety,
station operations, and research missions. Tier 1 is highest priority
(never shed); Tier 3 is lowest priority (first to shed).

═══════════════════════════════════════════════════════════════
TIER 1 — LIFE SAFETY (NEVER SHED — Protected Circuit)
═══════════════════════════════════════════════════════════════
These loads must remain powered in ALL emergency scenarios.
Combined typical power: 40–80 kW

Equipment List:
  • Medical bay — life support, defibrillator, O2 supply: 5 kW
  • Emergency communication — HF radio, satellite phone: 3 kW
  • Fire alarm and suppression system: 2 kW
  • Emergency lighting (LED battery-backed): 1 kW
  • Sleeping quarter heating (min 15°C survival temp): 20 kW
  • Kitchen — minimum food preparation circuit: 8 kW
  • Server room — core data storage (not full cluster): 5 kW
  • Fuel pump system (generator feed): 2 kW
  • Water treatment — essential potable water: 4 kW

Maitri Tier 1 loads ~45 kW | Bharati Tier 1 loads ~65 kW | Himadri ~20 kW

═══════════════════════════════════════════════════════════════
TIER 2 — STATION OPERATIONS (SHED ONLY IN EMERGENCY)
═══════════════════════════════════════════════════════════════
Shed when power deficit exceeds 30 kW or fuel < 20%.
Combined typical power: 60–120 kW

Equipment List:
  • Full laboratory heating (reduce to Tier 1 minimum): 15 kW saved
  • Scientific instrument cluster (non-critical instruments): 20 kW
  • Full kitchen operation (reduce to minimal cooking): 12 kW
  • Dining and common area lighting: 5 kW
  • Hot water system (reduce from continuous to scheduled): 8 kW
  • Data processing — partial computing cluster: 15 kW
  • Laundry facilities: 10 kW
  • Weather monitoring equipment: 3 kW

Total shedding potential from Tier 2: ~88 kW

═══════════════════════════════════════════════════════════════
TIER 3 — NON-ESSENTIAL (FIRST TO SHED — Voluntary Reduction)
═══════════════════════════════════════════════════════════════
Shed first in any conservation or emergency scenario.
Combined typical power: 40–90 kW

Equipment List:
  • Recreation room heating and equipment: 15 kW
  • Workshop electric heating (reduce to frost protection): 20 kW
  • Vehicle/cargo bay heating (non-critical): 18 kW
  • Full scientific computing cluster (non-priority research): 25 kW
  • Training and conference room: 5 kW
  • Non-essential exterior lighting: 3 kW
  • Sauna/shower block (non-essential): 10 kW
  • All EV/vehicle charging: 12 kW

Total shedding potential from Tier 3: ~108 kW

LOAD SHEDDING TRIGGER TABLE
------------------------------
Condition                  | Action Required
---------------------------+-----------------
Power deficit < 20 kW      | Request Tier 3 voluntary reduction
Power deficit 20–60 kW     | Enforce Tier 3 shedding
Power deficit 60–100 kW    | Enforce Tier 3 + partial Tier 2
Power deficit > 100 kW     | Enforce Tier 2 full + evaluate Tier 1 reduction
Fuel < 15% OR SOC < 20%    | Emergency: Tier 1 only mode
        """,
        "keywords": [
            "load priority", "tier", "tier 1", "tier 2", "tier 3",
            "load shedding", "critical loads", "life safety", "priority",
            "shed", "power deficit", "load classification", "emergency loads",
            "station equipment", "load management"
        ],
        "source": "NCPOR Electrical Operations Standard EOS-007 (2024)"
    },

    # ── 12. Renewable Integration Guide ─────────────────────────────────────
    {
        "id": "RENEW-INT-001",
        "title": "Renewable Energy Integration Guide — Polar Station Microgrids",
        "category": "renewable",
        "content": """
RENEWABLE ENERGY INTEGRATION GUIDE
Polar Station Microgrid Operations — NCPOR Technical Guidance

PRIORITY DISPATCH HIERARCHY
-----------------------------
In a polar microgrid, generation dispatch follows this strict priority order:

Priority 1 — Solar PV (Zero marginal cost, zero emissions)
  • Always dispatch at maximum available output
  • MPPT (Maximum Power Point Tracking) must be enabled at all times
  • Panel efficiency degrades with snow/ice cover — monitor output vs. irradiance

Priority 2 — Wind Turbines (Zero marginal cost, zero emissions)
  • Always dispatch at maximum available output
  • Automatic shutdown at cut-out wind speed (varies by turbine model)
  • Blade heating recommended below -15°C to prevent icing

Priority 3 — Battery Storage (Stored renewable or diesel energy)
  • Discharge to fill gap between renewable output and demand
  • Reserve 20% SOC as emergency backup (never discharge below SOC_MIN)
  • Charge using excess renewable before diesel generation

Priority 4 — Diesel Generators (Last resort, highest cost and emissions)
  • Start only when renewable + battery cannot meet demand
  • Maintain at 40–80% rated load (wet stacking and efficiency concern)

CURTAILMENT RULES
------------------
Renewable curtailment (deliberate reduction of renewable output) occurs when:
  Rule 1: Battery is at 95%+ SOC AND total load is fully met
    → Curtail excess solar/wind to prevent battery overcharge
    → Curtailment sequence: Solar first (easier to control), then Wind
  
  Rule 2: Grid frequency/voltage instability (if grid-connected)
    → MPPT inverters receive curtailment signal from EMS
    → Reduce solar output by adjusting MPPT setpoint below Vmpp
  
  Rule 3: Generator minimum load constraint
    → If diesel running + renewables exceed demand (wet stacking risk)
    → Curtail renewables to maintain diesel at 40% minimum load
    → Document all curtailment events

MPPT SETTINGS FOR POLAR ENVIRONMENTS
--------------------------------------
• Panel temperature coefficient: −0.45%/°C (power decreases at high temp)
  BUT at polar temps (−30°C), panels can EXCEED rated power by 10–15%
  → Set MPPT max voltage to 110% of STC Voc (to capture cold-boost)
  → Ensure inverter input voltage rating accommodates Voc at −40°C

• Snow on panels: Manual clearing triggers power step-change
  → MPPT algorithm must handle step changes without fault trip
  → Set MPPT scan interval to 60 seconds in variable conditions

RENEWABLE FRACTION TARGETS
----------------------------
Station       | Current Target | 2030 Target | Achievable Peak
--------------+----------------+-------------+----------------
Maitri        |     20%        |    35%      |    60% (summer)
Bharati       |     25%        |    40%      |    70% (summer)
Himadri       |     15%        |    30%      |    50% (summer)
        """,
        "keywords": [
            "renewable", "solar", "wind", "integration", "MPPT",
            "curtailment", "priority dispatch", "microgrid", "generation",
            "renewable fraction", "solar PV", "wind turbine", "battery charging",
            "dispatch", "green energy", "clean energy", "optimization"
        ],
        "source": "NCPOR Renewable Integration Technical Guide, RTG-2024-001"
    },

    # ── 13. CO2 Monitoring Requirements ─────────────────────────────────────
    {
        "id": "ENV-CO2-001",
        "title": "CO2 and Emissions Monitoring Requirements — Antarctic Treaty Compliance",
        "category": "environmental",
        "content": """
CO2 AND EMISSIONS MONITORING REQUIREMENTS
Antarctic Treaty Obligations — NCPOR Environmental Compliance

MONITORING OBLIGATIONS
-----------------------
Under the Madrid Protocol (1991) and ATCM Resolution 4 (2014),
all national Antarctic programs must monitor and report:
  1. Total CO2 equivalent emissions from station operations
  2. Fuel consumption by source type and quantity
  3. Renewable energy generation and displaced diesel emissions
  4. Any accidental releases (spills, refrigerant, etc.)

PER-STATION ANNUAL CO2 LIMITS
--------------------------------
These limits are NCPOR internal targets aligned with treaty obligations:

Maitri Station (Antarctica):
  ■ Max diesel consumption: 350,000 L/year
  ■ Max CO2 equivalent: 850 tonnes CO2-eq/year
  ■ Renewable offset target: 70 tonnes CO2 displaced by renewables
  ■ Current baseline (2023): ~620 tonnes CO2 (30% below limit)

Bharati Station (Antarctica):
  ■ Max diesel consumption: 500,000 L/year
  ■ Max CO2 equivalent: 1,200 tonnes CO2-eq/year
  ■ Renewable offset target: 120 tonnes CO2 displaced by renewables
  ■ Current baseline (2023): ~880 tonnes CO2 (27% below limit)

Himadri Station (Svalbard/Arctic):
  ■ Max diesel consumption: 130,000 L/year
  ■ Max CO2 equivalent: 320 tonnes CO2-eq/year
  ■ Primary power: Kings Bay community grid (coal reducing to renewables)
  ■ Current baseline (2023): ~95 tonnes CO2 (from backup diesel only)

EMISSIONS CALCULATION METHODOLOGY
-----------------------------------
CO2 from diesel = Fuel consumed (L) × 2.68 kg CO2/L
                = Diesel kWh × 0.82 kg CO2/kWh

Emission factors:
  Diesel (EN590): 2.68 kg CO2/L
  Diesel (kWh):   0.82 kg CO2/kWh
  Solar/Wind:     0 kg CO2/kWh (operational)
  Battery:        0 kg CO2/kWh (operational, embodied carbon not counted)

MONITORING EQUIPMENT AND FREQUENCY
-------------------------------------
Continuous (real-time):
  • Exhaust CO sensor at generator outlet
  • Fuel flow meters on all generator fuel lines
  • Power meters on all generation sources

Monthly:
  • Calibrate exhaust sensors against reference gas
  • Manual fuel stock take and reconciliation
  • CO2 tally report to station commander

Annual:
  • Formal NCPOR Emissions Inventory Report
  • Submission to Antarctic Treaty parties (via COMNAP)
  • Five-year trend analysis and target revision
        """,
        "keywords": [
            "CO2", "carbon", "emissions", "monitoring", "environmental",
            "annual limit", "treaty", "compliance", "greenhouse gas",
            "fuel consumption", "diesel emissions", "carbon tracking",
            "850 tonnes", "1200 tonnes", "320 tonnes", "emission factor",
            "carbon footprint", "reporting"
        ],
        "source": "NCPOR Environmental Compliance Manual ECM-2024 (Madrid Protocol Implementation)"
    },

    # ── 14. Winter Operations Checklist ─────────────────────────────────────
    {
        "id": "OPS-WINTER-001",
        "title": "Antarctic Winter Operations Checklist — October to March Protocol",
        "category": "operations",
        "content": """
ANTARCTIC SUMMER / EARLY WINTER OPERATIONS CHECKLIST
October–March Protocol — Maitri and Bharati Stations

CONTEXT
--------
October–March is the Antarctic "summer" season with maximum solar
availability, higher occupancy (summer expeditions), increased loads,
and transition into/out of polar night (May–August actual winter).
This checklist covers preparation and operations during this period.

PRE-SEASON PREPARATION (September–October)
--------------------------------------------
☐ Solar panel inspection and cleaning (after winter accumulation)
☐ Wind turbine pre-season inspection: blade integrity, pitch system, bearings
☐ Generator A/B full service (oil, filters, injectors, belts)
☐ Battery bank health assessment (SOH measurement, cell balancing)
☐ Fuel delivery confirmation and tank top-up to 90%+ before season
☐ BESS heating system test (verify heating blankets functional)
☐ All Tier-1 emergency circuits tested under load

OCTOBER — SOLAR RAMP-UP
-------------------------
☐ Enable solar PV arrays (panels cleared of winter snow)
☐ Verify MPPT inverter communications and firmware current
☐ Baseline solar yield measurement (compare to previous year)
☐ Adjust generator schedule — reduce diesel share as solar increases
☐ Battery cycling test: full charge/discharge to verify capacity

NOVEMBER–JANUARY — PEAK SUMMER OPERATIONS
-------------------------------------------
☐ Maximize renewable fraction (target 50–70% of load from solar+wind)
☐ Monitor battery SOC — charge to 90%+ during midnight sun excess
☐ Generator efficiency check: load factors, fuel consumption rate
☐ Thermal management: buildings may require cooling (not just heating!)
☐ Occupancy increases — update load estimates for summer team
☐ Schedule heavy loads during peak solar window (11:00–16:00 local)

FEBRUARY–MARCH — TRANSITION TO WINTER
---------------------------------------
☐ Solar yield declining — gradually increase diesel schedule
☐ Fuel stock assessment — confirm resupply ordered for winter stock
☐ Begin load auditing — identify non-essentials for winter hibernation
☐ Battery pre-winter check: target 80% SOH minimum for winter service
☐ Update polar night load shedding plan (SOP 4.2 review)
☐ Reduce summer team heating loads as occupancy decreases

ENERGY TARGETS (Summer Season)
--------------------------------
  Renewable fraction: > 35% (minimum target)
  Diesel consumption: < 200,000 L for full season (Maitri)
  CO2 emissions: < 400 tonnes (Maitri summer allocation)
  Battery cycling: maintain 80%+ SOH through season
        """,
        "keywords": [
            "winter", "summer", "season", "checklist", "operations",
            "october", "march", "seasonal", "preparation", "solar ramp",
            "panel cleaning", "generator service", "battery check",
            "pre-season", "antarctic summer", "polar operations"
        ],
        "source": "NCPOR Antarctic Station Operations Calendar, AOC-2024"
    },

    # ── 15. Battery State of Health Assessment ────────────────────────────────
    {
        "id": "BATT-SOH-001",
        "title": "Battery State of Health (SOH) Assessment and Replacement Protocol",
        "category": "battery",
        "content": """
BATTERY STATE OF HEALTH (SOH) ASSESSMENT
Polar Station Energy Storage — Monitoring and Replacement Protocol

WHAT IS SOH?
-------------
State of Health (SOH) represents the remaining useful capacity of a
battery relative to its original rated capacity when new:

  SOH (%) = (Current Maximum Capacity / Original Rated Capacity) × 100

A new battery has SOH = 100%. As the battery ages through charge/discharge
cycles and temperature stress, SOH degrades.

SOH THRESHOLDS AND ACTIONS
----------------------------
SOH > 90%: ✅ HEALTHY — Normal operation, no action needed
SOH 80–90%: ⚠️ GOOD — Monitor quarterly, plan for replacement in 1–2 years
SOH 70–80%: ⚠️ DEGRADED — Increase monitoring to monthly, plan replacement
SOH 60–70%: 🔴 POOR — Replacement required within 6 months
SOH < 60%:  🔴 CRITICAL — Immediate replacement required
             Station cannot rely on battery for emergency backup at < 60% SOH

REPLACEMENT TRIGGERS (ANY ONE SUFFICIENT)
------------------------------------------
• SOH drops below 70%
• Battery fails to accept charge above 85% SOC at standard C/5 rate
• Internal resistance increases >50% from initial commissioning value
• More than 3 cells in a module showing >20% capacity variance (cell balancing lost)
• Any cell thermal runaway event (even if contained)
• Physical damage to battery enclosure or cooling system

SOH MEASUREMENT METHODS
-------------------------
Method 1 — Discharge Test (Most Accurate):
  • Charge battery to 100% SOC
  • Discharge at constant C/5 rate to 20% SOC
  • Measure total Ah (amp-hours) discharged
  • Compare to rated Ah at factory spec
  • Requires 6–8 hours — schedule during low-demand periods

Method 2 — BMS Estimation (Continuous):
  • BMS estimates SOH using Coulomb counting + internal resistance measurement
  • Accuracy: ±5% under normal conditions, ±10% in extreme cold
  • Calibrate BMS estimate against discharge test annually

Method 3 — Electrochemical Impedance Spectroscopy (EIS):
  • Specialist equipment required (sent from mainland)
  • Highly accurate, non-destructive, no disruption to operations
  • Recommended for pre-winter assessment

POLAR-SPECIFIC SOH DEGRADATION FACTORS
----------------------------------------
• Cold temperature cycling: Each winter season in polar conditions
  accelerates SOH degradation by 5–10% additional vs. temperate climate
• Deep discharge events below SOC_MIN: Each deep discharge < 10%
  causes ~0.5–1% additional SOH loss
• Thermal shock: Rapid temperature changes stress cell chemistry
• High-rate charging: C-rate > 0.5C at temperatures below 0°C causes
  additional degradation (lithium plating)

PROCUREMENT LEAD TIMES
-----------------------
• Lithium battery modules (LiFePO4, NMC): 6–12 month procurement lead time
• Customs and Antarctic Treaty environmental approvals: 3–6 months additional
• Total procurement + delivery: Allow 18 months minimum from decision to replacement
• ORDER TRIGGER: Begin procurement when SOH drops below 75% (to avoid 60% crisis)
        """,
        "keywords": [
            "SOH", "state of health", "battery health", "battery aging",
            "battery replacement", "capacity degradation", "BMS", "discharge test",
            "battery monitoring", "cell", "lithium", "replacement trigger",
            "70%", "60%", "battery assessment", "cycle life", "degradation"
        ],
        "source": "NCPOR Battery Systems Technical Manual, Section 7 — SOH Protocol (2024)"
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# KNOWLEDGE BASE CLASS
# ─────────────────────────────────────────────────────────────────────────────

class PolarKnowledgeBase:
    """
    Simulated vector knowledge base for polar station operational documents.
    Uses TF-IDF-inspired keyword scoring for document retrieval without
    requiring any external vector database or LLM API.

    Retrieval approach:
      1. Tokenize and normalize the query
      2. Score each document by keyword overlap and frequency
      3. Apply category and title boost scoring
      4. Return top_k documents ranked by relevance score
    """

    def __init__(self):
        """Initialize knowledge base and pre-process documents for retrieval."""
        self._documents = KNOWLEDGE_DOCUMENTS
        self._categories = list({doc["category"] for doc in self._documents})
        # Pre-compute keyword sets for fast lookup
        self._doc_keyword_sets = [
            {kw.lower() for kw in doc["keywords"]}
            for doc in self._documents
        ]

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def retrieve(self, query: str, top_k: int = 3) -> list:
        """
        Retrieve the top_k most relevant documents for a given query.

        Scoring algorithm:
          - Exact keyword match in keywords list: +3.0 per hit
          - Partial keyword match (keyword contained in query): +1.5
          - Query token found in document content: +0.5 per occurrence (capped)
          - Title match: +4.0 if any query word in title
          - Category match signals: +1.0 bonus for inferred category

        Args:
            query:  Free-text query from the operator
            top_k:  Number of top documents to return (default 3)

        Returns:
            List of dicts: [{document: {...}, relevance_score: float, excerpt: str}]
        """
        query_lower = query.lower()
        # Tokenize query into individual words (ignore short words)
        query_tokens = set(
            token for token in re.split(r"[\s,;.!?/\-]+", query_lower)
            if len(token) >= 3
        )

        scored = []

        for idx, doc in enumerate(self._documents):
            score = 0.0
            doc_keyword_set = self._doc_keyword_sets[idx]
            content_lower = doc["content"].lower()
            title_lower = doc["title"].lower()

            # ── Keyword matching ──────────────────────────────────────────
            for kw in doc_keyword_set:
                kw_lower = kw.lower()
                if kw_lower in query_lower:
                    # Full phrase match in query — high score
                    score += 3.0
                elif any(token in kw_lower or kw_lower in token
                         for token in query_tokens if len(token) >= 4):
                    # Partial overlap between keyword and query token
                    score += 1.5

            # ── Content term frequency ────────────────────────────────────
            content_hits = 0
            for token in query_tokens:
                # Count how many times the token appears in content
                hits = len(re.findall(r"\b" + re.escape(token) + r"\b", content_lower))
                content_hits += min(hits, 5)  # cap per token to avoid flooding
            score += content_hits * 0.4

            # ── Title match boost ─────────────────────────────────────────
            title_matches = sum(1 for token in query_tokens if token in title_lower)
            score += title_matches * 4.0

            # ── Category signal boost ─────────────────────────────────────
            # Infer likely category from query keywords and boost matching docs
            category_signals = {
                "emergency": ["blizzard", "storm", "emergency", "whiteout", "alert"],
                "fuel": ["fuel", "diesel", "tank", "refuel", "runway"],
                "battery": ["battery", "soc", "charge", "lithium", "storage"],
                "maintenance": ["wet stacking", "engine", "smoke", "maintenance"],
                "environmental": ["co2", "carbon", "treaty", "emission", "madrid"],
                "conservation": ["conservation", "polar night", "reduce", "winter"],
                "operations": ["startup", "cold start", "checklist", "procedure"],
                "load_management": ["load", "tier", "shedding", "priority", "shed"],
                "renewable": ["solar", "wind", "renewable", "mppt", "curtail"],
                "station_manual": ["maitri", "bharati", "himadri", "station", "capacity"],
            }
            doc_category = doc.get("category", "")
            for cat, signals in category_signals.items():
                if cat == doc_category:
                    for sig in signals:
                        if sig in query_lower:
                            score += 1.5
                            break

            # ── Minimum threshold ─────────────────────────────────────────
            if score > 0.1:
                # Generate a concise excerpt from the document
                excerpt = self._generate_excerpt(doc["content"], query_tokens)
                scored.append({
                    "document": doc,
                    "relevance_score": round(score, 3),
                    "excerpt": excerpt,
                })

        # Sort by descending relevance score and return top_k
        scored.sort(key=lambda x: x["relevance_score"], reverse=True)
        return scored[:top_k]

    # ── Excerpt extraction ────────────────────────────────────────────────────

    def _generate_excerpt(self, content: str, query_tokens: set, max_chars: int = 400) -> str:
        """
        Find the most relevant paragraph in the document content.
        Returns a clean excerpt of up to max_chars characters.
        """
        # Split content into non-empty paragraphs
        paragraphs = [p.strip() for p in content.split("\n") if len(p.strip()) > 30]

        if not paragraphs:
            return content[:max_chars].strip() + "..."

        # Score each paragraph by query token density
        best_para = paragraphs[0]
        best_score = 0

        for para in paragraphs:
            para_lower = para.lower()
            para_score = sum(
                1 for token in query_tokens
                if token in para_lower
            )
            if para_score > best_score:
                best_score = para_score
                best_para = para

        # Trim to max_chars
        if len(best_para) > max_chars:
            best_para = best_para[:max_chars].rsplit(" ", 1)[0] + "..."

        return best_para

    # ── Utility methods ───────────────────────────────────────────────────────

    def get_all_categories(self) -> list:
        """Return a sorted list of unique document categories."""
        return sorted(self._categories)

    def get_document_by_id(self, doc_id: str) -> Optional[dict]:
        """
        Retrieve a specific document by its unique ID.

        Args:
            doc_id: Document ID string (e.g., "SOP-4.1", "BATT-CW-002")

        Returns:
            Document dict or None if not found
        """
        for doc in self._documents:
            if doc["id"] == doc_id:
                return doc
        return None

    def get_documents_by_category(self, category: str) -> list:
        """Return all documents matching a given category."""
        return [doc for doc in self._documents if doc["category"] == category]

    @property
    def document_count(self) -> int:
        """Total number of documents in the knowledge base."""
        return len(self._documents)
