"""
Analytics API — multi-period energy analytics and carbon metrics.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime, timedelta
import random

router = APIRouter()


@router.get("/summary")
def get_analytics_summary(
    station_id: int = Query(1),
    period: str = Query("30d"),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {}

    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    gen = PolarDataGenerator()
    gen._soc_state[station.id] = 80.0
    gen._fuel_state[station.id] = 85.0

    # Sample every 3 hours for performance
    readings = []
    for d in range(days - 1, -1, -1):
        for h in [0, 3, 6, 9, 12, 15, 18, 21]:
            ts = datetime.utcnow() - timedelta(days=d, hours=0) + timedelta(hours=h)
            r = gen.generate_reading(station, ts, scenario)
            readings.append(r)

    if not readings:
        return {}

    n = len(readings)
    total_load = sum(r["total_load_kw"] for r in readings)
    total_solar = sum(r["solar_kw"] for r in readings)
    total_wind = sum(r["wind_kw"] for r in readings)
    total_diesel = sum(r["diesel_kw"] for r in readings)
    total_renewable = total_solar + total_wind
    avg_efficiency = sum(r["efficiency_pct"] for r in readings) / n
    total_co2_avoided = sum(r["carbon_avoided_kg"] for r in readings)
    total_co2_emitted = sum(r["co2_emissions_kg"] for r in readings)

    # Day-by-day for charts
    daily = {}
    for r in readings:
        day = r["timestamp"][:10] if isinstance(r["timestamp"], str) else r["timestamp"].strftime("%Y-%m-%d")
        if day not in daily:
            daily[day] = {"load": 0, "solar": 0, "wind": 0, "diesel": 0, "renewable_pct": [], "efficiency": []}
        daily[day]["load"] += r["total_load_kw"]
        daily[day]["solar"] += r["solar_kw"]
        daily[day]["wind"] += r["wind_kw"]
        daily[day]["diesel"] += r["diesel_kw"]
        daily[day]["renewable_pct"].append(r["renewable_pct"])
        daily[day]["efficiency"].append(r["efficiency_pct"])

    trend = [
        {
            "date": day,
            "total_load_kwh": round(v["load"], 1),
            "solar_kwh": round(v["solar"], 1),
            "wind_kwh": round(v["wind"], 1),
            "diesel_kwh": round(v["diesel"], 1),
            "renewable_pct": round(sum(v["renewable_pct"]) / len(v["renewable_pct"]), 1),
            "efficiency_pct": round(sum(v["efficiency"]) / len(v["efficiency"]), 1),
        }
        for day, v in sorted(daily.items())
    ]

    # Hourly heatmap (average load by hour)
    hourly = {}
    for r in readings:
        ts = r["timestamp"]
        if isinstance(ts, str):
            h = int(ts[11:13])
        else:
            h = ts.hour
        if h not in hourly:
            hourly[h] = []
        hourly[h].append(r["total_load_kw"])
    heatmap = [{"hour": h, "avg_load_kw": round(sum(v) / len(v), 1)} for h, v in sorted(hourly.items())]

    return {
        "station_id": station_id,
        "period": period,
        "days": days,
        "is_simulated": True,
        "totals": {
            "energy_consumed_kwh": round(total_load, 1),
            "renewable_kwh": round(total_renewable, 1),
            "solar_kwh": round(total_solar, 1),
            "wind_kwh": round(total_wind, 1),
            "diesel_kwh": round(total_diesel, 1),
            "renewable_pct": round(total_renewable / total_load * 100 if total_load else 0, 1),
            "avg_efficiency_pct": round(avg_efficiency, 1),
            "co2_avoided_kg": round(total_co2_avoided * 1000, 1),
            "co2_emitted_kg": round(total_co2_emitted * 1000, 1),
            "fuel_consumed_liters": round(total_diesel * 0.25, 1),
        },
        "trend": trend,
        "heatmap": heatmap,
    }


@router.get("/carbon")
def get_carbon_metrics(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {}

    gen = PolarDataGenerator()
    readings = []
    for h in range(720, 0, -1):  # 30 days hourly
        ts = datetime.utcnow() - timedelta(hours=h)
        r = gen.generate_reading(station, ts, scenario)
        readings.append(r)

    total_renewable = sum(r["solar_kw"] + r["wind_kw"] for r in readings)
    total_load = sum(r["total_load_kw"] for r in readings)
    total_diesel = sum(r["diesel_kw"] for r in readings)

    co2_avoided = total_renewable * 0.82   # kg per kWh emission factor
    co2_emitted = total_diesel * 0.82
    renewable_pct = total_renewable / total_load * 100 if total_load else 0

    # Equivalent trees (1 tree absorbs ~22kg CO2/year)
    trees_equiv = co2_avoided / 22

    return {
        "station_id": station_id,
        "period": "30d",
        "is_simulated": True,
        "co2_avoided_kg": round(co2_avoided, 1),
        "co2_emitted_kg": round(co2_emitted, 1),
        "co2_net_kg": round(co2_emitted - co2_avoided, 1),
        "renewable_contribution_pct": round(renewable_pct, 1),
        "trees_equivalent": round(trees_equiv, 0),
        "fuel_saved_vs_diesel_only_liters": round(total_renewable * 0.25, 1),
        "diesel_reduction_pct": round(renewable_pct, 1),
        "sustainability_score": round(min(100, renewable_pct * 1.1), 1),
    }


@router.get("/efficiency")
def get_efficiency_trends(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    gen = PolarDataGenerator()
    trend = []
    for d in range(29, -1, -1):
        ts = datetime.utcnow() - timedelta(days=d)
        r = gen.generate_reading(station, ts, scenario)
        trend.append({
            "date": (datetime.utcnow() - timedelta(days=d)).strftime("%Y-%m-%d"),
            "efficiency_pct": r["efficiency_pct"],
            "renewable_pct": r["renewable_pct"],
        })
    return trend
