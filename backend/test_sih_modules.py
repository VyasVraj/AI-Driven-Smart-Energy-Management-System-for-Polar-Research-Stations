import sys
import os
os.environ["PYTHONUTF8"] = "1"
sys.path.insert(0, '.')

errors = []

try:
    from app.optimization.milp_optimizer import MILPOptimizer
    print("[PASS] MILPOptimizer imported OK")
except Exception as e:
    print(f"[FAIL] MILPOptimizer: {e}")
    errors.append("milp_optimizer")

try:
    from app.optimization.mpc_controller import MPCController
    print("[PASS] MPCController imported OK")
except Exception as e:
    print(f"[FAIL] MPCController: {e}")
    errors.append("mpc_controller")

try:
    from app.ml.battery_thermal_model import BatteryThermalModel
    btm = BatteryThermalModel()
    cap = btm.get_effective_capacity(600, -25)
    print(f"[PASS] BatteryThermalModel: 600kWh @ -25C = {cap:.0f}kWh effective")
except Exception as e:
    print(f"[FAIL] BatteryThermalModel: {e}")
    errors.append("battery_thermal_model")

try:
    from app.safety.load_shedding import LoadSheddingController
    lsc = LoadSheddingController()
    ts = lsc.get_tier_summary()
    t1 = ts["critical"]["total_power_kw"]
    t3 = ts["deferrable"]["total_power_kw"]
    grand = ts["grand_total_kw"]
    print(f"[PASS] LoadSheddingController: Critical={t1}kW Deferrable={t3}kW Grand={grand}kW")
except Exception as e:
    print(f"[FAIL] LoadSheddingController: {e}")
    errors.append("load_shedding")

try:
    opt = MILPOptimizer()
    plan = opt.solve_24h_plan({
        "solar_forecast": [30.0]*24,
        "wind_forecast": [80.0]*24,
        "demand_forecast": [200.0]*24,
        "battery_soc_init": 70.0,
        "battery_capacity_kwh": 600.0,
        "fuel_level_pct": 65.0,
        "fuel_tank_liters": 60000.0,
        "temperature_c": -22.0,
        "genset_rated_kw": 300.0,
    })
    print(f"[PASS] MILP solve_24h_plan: status={plan['solver_status']} | fuel={plan['total_fuel_liters']:.1f}L | renewable={plan['renewable_fraction_pct']:.1f}%")
    print(f"       CO2 saved={plan['co2_savings_vs_baseline_kg']:.1f}kg | diesel_runtime={plan['diesel_runtime_hours']}h")
except Exception as e:
    print(f"[FAIL] MILP solve_24h_plan: {e}")
    errors.append("milp_solve")

print()
if errors:
    print(f"[SUMMARY] {len(errors)} failure(s): {', '.join(errors)}")
else:
    print("[SUMMARY] ALL MODULES PASSED - SIH upgrades ready!")
