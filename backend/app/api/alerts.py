"""
Alerts API — active alerts with auto-generated scenario-aware alerts.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.alert import Alert
from app.models.station import Station
from app.simulation.data_generator import PolarDataGenerator
from datetime import datetime, timedelta
import random

router = APIRouter()
_sim = PolarDataGenerator()


def _generate_dynamic_alerts(station, state: dict) -> list:
    """Generate alerts based on current station state."""
    alerts = []
    now = datetime.utcnow()

    if state["fuel_level_pct"] < 15:
        alerts.append({
            "id": 1001, "station_id": station.id, "station_name": station.name,
            "alert_type": "LOW_FUEL", "severity": "CRITICAL",
            "title": "Critical Fuel Level",
            "message": f"Fuel tank at {state['fuel_level_pct']:.1f}% — emergency threshold breached.",
            "cause": "High diesel consumption with no resupply scheduled.",
            "recommended_action": "Immediately reduce non-critical loads. Initiate emergency resupply. Charge battery to maximum SOC.",
            "is_acknowledged": False,
            "created_at": (now - timedelta(minutes=15)).isoformat(),
        })
    elif state["fuel_level_pct"] < 30:
        alerts.append({
            "id": 1002, "station_id": station.id, "station_name": station.name,
            "alert_type": "LOW_FUEL", "severity": "HIGH",
            "title": "Low Fuel Warning",
            "message": f"Fuel level at {state['fuel_level_pct']:.1f}% — below recommended 30% reserve.",
            "cause": "Extended diesel operation during low renewable availability.",
            "recommended_action": "Schedule fuel resupply. Reduce diesel runtime by maximising battery discharge during peak hours.",
            "is_acknowledged": False,
            "created_at": (now - timedelta(hours=2)).isoformat(),
        })

    if state["battery_soc_pct"] < 20:
        alerts.append({
            "id": 1003, "station_id": station.id, "station_name": station.name,
            "alert_type": "LOW_BATTERY", "severity": "CRITICAL",
            "title": "Battery Critical — Deep Discharge Risk",
            "message": f"Battery SOC at {state['battery_soc_pct']:.1f}% — below safe 20% minimum.",
            "cause": "Extended battery discharge without sufficient renewable recharge.",
            "recommended_action": "Activate diesel generator for immediate battery charging. Protect critical loads.",
            "is_acknowledged": False,
            "created_at": (now - timedelta(minutes=5)).isoformat(),
        })
    elif state["battery_soc_pct"] < 35:
        alerts.append({
            "id": 1004, "station_id": station.id, "station_name": station.name,
            "alert_type": "LOW_BATTERY", "severity": "WARNING",
            "title": "Low Battery Reserve",
            "message": f"Battery SOC at {state['battery_soc_pct']:.1f}% — limited backup capacity.",
            "cause": "Higher than average load with limited renewable generation.",
            "recommended_action": "Prioritise battery charging. Defer non-critical loads to off-peak hours.",
            "is_acknowledged": False,
            "created_at": (now - timedelta(hours=1)).isoformat(),
        })

    if state["wind_speed_kmh"] > 65:
        alerts.append({
            "id": 1005, "station_id": station.id, "station_name": station.name,
            "alert_type": "EXTREME_WEATHER", "severity": "HIGH",
            "title": "Extreme Wind — Turbine Shutdown Risk",
            "message": f"Wind speed at {state['wind_speed_kmh']:.1f} km/h — approaching turbine cut-out speed.",
            "cause": "Severe weather system passing through the station area.",
            "recommended_action": "Monitor turbine health. Pre-charge battery. Prepare diesel for immediate startup.",
            "is_acknowledged": False,
            "created_at": (now - timedelta(minutes=30)).isoformat(),
        })

    if state["temperature_c"] < -35:
        alerts.append({
            "id": 1006, "station_id": station.id, "station_name": station.name,
            "alert_type": "EXTREME_COLD", "severity": "WARNING",
            "title": "Extreme Cold Alert",
            "message": f"Temperature at {state['temperature_c']:.1f}°C — heating load significantly elevated.",
            "cause": "Polar weather event causing temperatures well below seasonal average.",
            "recommended_action": "Implement zone heating control. Increase battery reserve to 70% for heating backup.",
            "is_acknowledged": False,
            "created_at": (now - timedelta(hours=3)).isoformat(),
        })

    # Always add one info alert
    alerts.append({
        "id": 1007, "station_id": station.id, "station_name": station.name,
        "alert_type": "AI_RECOMMENDATION", "severity": "INFO",
        "title": "AI Energy Optimization Available",
        "message": f"New optimization recommendation computed: potential {state['diesel_kw'] * 0.1 * 0.25:.1f} L diesel savings available.",
        "cause": "Periodic optimization engine analysis.",
        "recommended_action": "Review and apply the latest AI energy dispatch recommendation.",
        "is_acknowledged": False,
        "created_at": (now - timedelta(hours=4)).isoformat(),
    })

    return alerts


@router.get("")
def get_alerts(
    station_id: int = Query(1),
    severity: str = Query(""),
    acknowledged: str = Query(""),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return []

    # DB alerts
    q = db.query(Alert).filter(Alert.station_id == station_id)
    if severity:
        q = q.filter(Alert.severity == severity.upper())
    if acknowledged.lower() == "false":
        q = q.filter(Alert.is_acknowledged == False)
    elif acknowledged.lower() == "true":
        q = q.filter(Alert.is_acknowledged == True)
    db_alerts = [
        {
            "id": a.id, "station_id": a.station_id, "station_name": station.name,
            "alert_type": a.alert_type, "severity": a.severity,
            "title": a.title, "message": a.message, "cause": a.cause,
            "recommended_action": a.recommended_action,
            "is_acknowledged": a.is_acknowledged,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in q.order_by(Alert.created_at.desc()).limit(20).all()
    ]

    # Dynamic alerts from simulation
    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    dynamic = _generate_dynamic_alerts(station, state)

    if severity:
        dynamic = [a for a in dynamic if a["severity"] == severity.upper()]
    if acknowledged.lower() == "false":
        dynamic = [a for a in dynamic if not a["is_acknowledged"]]

    all_alerts = dynamic + db_alerts
    return sorted(all_alerts, key=lambda x: x.get("created_at", ""), reverse=True)


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.utcnow()
        db.commit()
        return {"status": "acknowledged", "alert_id": alert_id}
    # For dynamic alerts (id > 1000), just return success
    return {"status": "acknowledged", "alert_id": alert_id}


@router.get("/count")
def get_alert_count(
    station_id: int = Query(1),
    scenario: str = Query("normal"),
    db: Session = Depends(get_db)
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        return {"count": 0}
    state = _sim.generate_reading(station, datetime.utcnow(), scenario)
    dynamic = _generate_dynamic_alerts(station, state)
    unread = len([a for a in dynamic if not a["is_acknowledged"]])
    db_count = db.query(Alert).filter(Alert.station_id == station_id, Alert.is_acknowledged == False).count()
    return {"count": unread + db_count, "critical": len([a for a in dynamic if a["severity"] == "CRITICAL"])}
