from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.api import auth, stations, energy, renewable, battery, fuel, optimization, risk, anomalies, alerts, simulation, weather, reports, analytics, advisor, websocket
# SIH Upgrades: MPC optimizer and automated load shedding
try:
    from app.api import mpc, load_shedding as load_shedding_api
    _SIH_UPGRADES_AVAILABLE = True
except ImportError:
    _SIH_UPGRADES_AVAILABLE = False
    print("[WARN] SIH upgrade modules not yet available — run after build completes")
from datetime import datetime

async def background_simulation():
    from app.simulation.data_generator import PolarDataGenerator
    from app.models.station import Station
    
    sim = PolarDataGenerator()
    while True:
        try:
            db = SessionLocal()
            stations = db.query(Station).all()
            for station in stations:
                reading = sim.generate_reading(station, datetime.utcnow())
                # For demo purposes, just broadcast directly via WS without saving every 5s to avoid huge DB
                await websocket.manager.broadcast_to_station(
                    station.id, 
                    {"type": "energy_update", "data": {k: str(v) if isinstance(v, datetime) else v for k, v in reading.items()}}
                )
            db.close()
        except Exception as e:
            print("Background task error:", e)
        await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Seed demo data
    from data.seed_data import seed_database
    seed_database()
    
    # Start background task
    asyncio.create_task(background_simulation())
    
    yield

app = FastAPI(
    title="POLARIS ENERGY AI",
    description="AI-Powered Energy Intelligence & Optimization Platform for Polar Research Stations",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(stations.router, prefix="/api/stations", tags=["stations"])
app.include_router(energy.router, prefix="/api/energy", tags=["energy"])
app.include_router(renewable.router, prefix="/api/renewable", tags=["renewable"])
app.include_router(battery.router, prefix="/api/battery", tags=["battery"])
app.include_router(fuel.router, prefix="/api/fuel", tags=["fuel"])
app.include_router(optimization.router, prefix="/api/optimization", tags=["optimization"])
app.include_router(risk.router, prefix="/api/risk", tags=["risk"])
app.include_router(anomalies.router, prefix="/api/anomalies", tags=["anomalies"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["simulation"])
app.include_router(weather.router, prefix="/api/weather", tags=["weather"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(advisor.router, prefix="/api/advisor", tags=["advisor"])
app.include_router(websocket.router, tags=["websocket"])

# SIH Upgrades — register if build complete
if _SIH_UPGRADES_AVAILABLE:
    app.include_router(mpc.router, prefix="/api/mpc", tags=["mpc-optimizer"])
    app.include_router(load_shedding_api.router, prefix="/api/safety", tags=["load-shedding"])

@app.get("/")
async def root():
    return {"message": "POLARIS ENERGY AI Backend", "version": "1.0.0", "status": "operational"}

@app.get("/health")
async def health():
    return {"status": "healthy", "demo_mode": settings.DEMO_MODE}
