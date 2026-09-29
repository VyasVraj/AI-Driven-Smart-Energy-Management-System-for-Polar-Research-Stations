"""
Reports API — daily, weekly energy reports with CSV export.
"""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime, timedelta
import csv
import io

router = APIRouter()


def _build_report_data(station, days: int = 1, scenario: str = "normal") -> dict:
    gen = PolarDataGenerator()
    gen._soc_state[station.id] = 80.0
    gen._fuel_state[station.id] = 85.0

    readings = []
    for h in range(days * 24, 0, -1):
        ts = datetime.utcnow() - timedelta(hours=h)
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
    avg_soc = sum(r["battery_soc_pct"] for r in readings) / n
    avg_efficiency = sum(r["efficiency_pct"] for r in readings) / n
    total_co2_avoided = sum(r["carbon_avoided_kg"] * 1000 for r in readings)
    total_co2_emitted = sum(r["co2_emissions_kg"] * 1000 for r in readings)
    peak_load = max(r["total_load_kw"] for r in readings)
    min_load  = min(r["total_load_kw"] for r in readings)

    return {
        "station_id": station.id,
        "station_name": station.name,
        "period_days": days,
        "generated_at": datetime.utcnow().isoformat(),
        "is_simulated": True,
        "summary": {
            "total_energy_kwh": round(total_load, 1),
            "renewable_kwh": round(total_renewable, 1),
            "solar_kwh": round(total_solar, 1),
            "wind_kwh": round(total_wind, 1),
            "diesel_kwh": round(total_diesel, 1),
            "renewable_pct": round(total_renewable / total_load * 100 if total_load else 0, 1),
            "avg_battery_soc_pct": round(avg_soc, 1),
            "avg_efficiency_pct": round(avg_efficiency, 1),
            "co2_avoided_kg": round(total_co2_avoided, 1),
            "co2_emitted_kg": round(total_co2_emitted, 1),
            "fuel_consumed_liters": round(total_diesel * 0.25, 1),
            "peak_load_kw": round(peak_load, 1),
            "min_load_kw": round(min_load, 1),
        },
        "readings": [
            {
                "timestamp": r["timestamp"],
                "total_load_kw": r["total_load_kw"],
                "solar_kw": r["solar_kw"],
                "wind_kw": r["wind_kw"],
                "diesel_kw": r["diesel_kw"],
                "battery_soc_pct": r["battery_soc_pct"],
                "fuel_level_pct": r["fuel_level_pct"],
                "renewable_pct": r["renewable_pct"],
                "temperature_c": r["temperature_c"],
            }
            for r in readings
        ]
    }


@router.get("/daily")
def daily_report(
    station_id: int = Query(1),
    date: str = Query(""),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}
    return _build_report_data(station, days=1, scenario=scenario)


@router.get("/weekly")
def weekly_report(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}
    return _build_report_data(station, days=7, scenario=scenario)


@router.get("/monthly")
def monthly_report(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"error": "Station not found"}
    return _build_report_data(station, days=30, scenario=scenario)


@router.get("/export/csv")
def export_csv(
    station_id: int = Query(1),
    report_type: str = Query("daily"),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return Response("Station not found", status_code=404)

    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(report_type, 1)
    data = _build_report_data(station, days=days, scenario=scenario)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "timestamp", "total_load_kw", "solar_kw", "wind_kw",
        "diesel_kw", "battery_soc_pct", "fuel_level_pct",
        "renewable_pct", "temperature_c"
    ])
    writer.writeheader()
    for r in data.get("readings", []):
        writer.writerow(r)

    csv_content = output.getvalue()
    filename = f"polaris_{station.code}_{report_type}_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
