from app.database import SessionLocal
from app.models.station import Station
from app.models.user import User
from app.models.alert import Alert
from app.models.anomaly import Anomaly
from passlib.context import CryptContext
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_database():
    db = SessionLocal()
    try:
        # Check if users exist
        if db.query(User).first() is None:
            admin = User(email="admin@polaris.ai", username="admin", hashed_password=pwd_context.hash("Admin@123"), role="ADMIN")
            operator = User(email="operator@polaris.ai", username="operator", hashed_password=pwd_context.hash("Operator@123"), role="STATION_OPERATOR")
            researcher = User(email="researcher@polaris.ai", username="researcher", hashed_password=pwd_context.hash("Research@123"), role="RESEARCHER")
            db.add_all([admin, operator, researcher])
            db.commit()
            
        # Check if stations exist
        if db.query(Station).first() is None:
            s1 = Station(name="Maitri Station", code="MAIT", location="Antarctica", country="India", latitude=-70.77, longitude=11.73, capacity_solar_kw=120, capacity_wind_kw=200, capacity_battery_kwh=600, capacity_diesel_kw=300, fuel_tank_liters=60000)
            s2 = Station(name="Bharati Station", code="BHAR", location="East Antarctica", country="India", latitude=-69.41, longitude=76.19)
            s3 = Station(name="Himadri Station", code="HIMA", location="Svalbard", country="India", latitude=78.92, longitude=11.93)
            db.add_all([s1, s2, s3])
            db.commit()

            # Alerts
            a1 = Alert(station_id=1, alert_type="LOW_FUEL", severity="WARNING", title="Low Fuel Level", message="Fuel below 20%", cause="Usage", recommended_action="Refuel", is_acknowledged=False)
            db.add(a1)
            db.commit()
            
            # Anomalies
            an1 = Anomaly(station_id=1, timestamp=datetime.utcnow(), component="Generator", description="High temp", severity="MEDIUM", deviation_pct=15.0)
            db.add(an1)
            db.commit()
    finally:
        db.close()
