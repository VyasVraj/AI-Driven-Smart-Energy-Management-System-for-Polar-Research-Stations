"""
Comprehensive Polar Data Generator
Generates realistic time-series data for polar research station energy systems.
"""
import random
import math
from datetime import datetime, timedelta


class PolarDataGenerator:
    """Generates realistic energy and weather data for polar research stations."""

    # Station-specific scenario states (in-memory, per instance)
    def __init__(self):
        self._soc_state = {}   # station_id -> current SOC
        self._fuel_state = {}  # station_id -> current fuel level %

    # ── Polar condition helpers ───────────────────────────────────────────────

    def _is_polar_night(self, lat: float, month: int) -> bool:
        """True when solar generation is effectively zero due to polar night."""
        if lat < -60 and month in [5, 6, 7, 8]:   # Antarctic winter
            return True
        if lat > 60 and month in [11, 12, 1, 2]:   # Arctic winter
            return True
        return False

    def _is_midnight_sun(self, lat: float, month: int) -> bool:
        """True during continuous daylight."""
        if lat < -60 and month in [11, 12, 1, 2]:  # Antarctic summer
            return True
        if lat > 60 and month in [5, 6, 7]:         # Arctic summer
            return True
        return False

    def _solar_irradiance(self, lat: float, month: int, hour: int,
                          cloud_pct: float = 20.0, scenario: str = 'normal') -> float:
        """Return realistic solar irradiance W/m² for location and time."""
        if self._is_polar_night(lat, month):
            return 0.0

        if self._is_midnight_sun(lat, month):
            # Continuous low-angle sun — peaks around noon, stays > 0 all day
            base = 350 + 150 * math.sin(math.pi * (hour - 6) / 12)
            base = max(50, base)
        else:
            if hour < 6 or hour > 19:
                return 0.0
            base = 700 * math.sin(math.pi * (hour - 6) / 13)
            base = max(0, base)

        # Cloud attenuation
        cloud_factor = 1.0 - (cloud_pct / 100.0) * 0.8
        irradiance = base * cloud_factor

        if scenario == 'storm':
            irradiance *= 0.08
        elif scenario == 'polar_night':
            irradiance = 0.0

        return max(0.0, irradiance + random.gauss(0, irradiance * 0.05))

    def _ambient_temperature(self, lat: float, month: int,
                              scenario: str = 'normal') -> float:
        """Realistic temperature °C for polar location and month."""
        if lat < -60:  # Antarctica
            # Range roughly −38 °C (winter) to −4 °C (summer)
            mean = -21 + 17 * math.sin(math.pi * (month - 1) / 6)
        else:  # Arctic (Svalbard)
            # Range roughly −20 °C to +5 °C
            mean = -7 + 13 * math.sin(math.pi * (month - 5) / 6)

        temp = mean + random.gauss(0, 3)

        if scenario == 'extreme_cold':
            temp -= 18
        elif scenario == 'storm':
            temp -= 8

        return round(temp, 1)

    def _wind_speed(self, scenario: str = 'normal') -> float:
        """Wind speed km/h."""
        if scenario == 'storm':
            return round(random.uniform(60, 85), 1)
        if scenario == 'high_demand':
            return round(random.uniform(25, 45), 1)
        return round(random.uniform(8, 40), 1)

    # ── Main reading generator ────────────────────────────────────────────────

    def generate_reading(self, station, timestamp: datetime,
                         scenario: str = 'normal') -> dict:
        """
        Generate a single synthetic energy reading for a station at a timestamp.
        Carries forward battery SOC and fuel level between calls when possible.
        """
        sid = station.id
        month = timestamp.month
        hour  = timestamp.hour

        # --- Weather ---
        cloud_pct = random.uniform(10, 40)
        if scenario == 'storm':
            cloud_pct = random.uniform(80, 100)
        wind_speed = self._wind_speed(scenario)
        temp_c     = self._ambient_temperature(station.latitude, month, scenario)
        irradiance = self._solar_irradiance(
            station.latitude, month, hour, cloud_pct, scenario)

        # --- Generation capacities ---
        solar_efficiency = 0.80
        wind_cut_in_kmh  = 10
        wind_rated_kmh   = 40
        wind_cut_out_kmh = 75

        solar_kw = 0.0
        if irradiance > 0:
            solar_kw = (irradiance / 1000.0) * station.capacity_solar_kw * solar_efficiency

        wind_kw = 0.0
        if wind_cut_in_kmh <= wind_speed < wind_cut_out_kmh:
            wind_fraction = min(1.0, (wind_speed - wind_cut_in_kmh) / (wind_rated_kmh - wind_cut_in_kmh))
            wind_kw = wind_fraction * station.capacity_wind_kw
        # Turbines shut off in extreme storm to protect equipment
        if wind_speed >= wind_cut_out_kmh:
            wind_kw = 0.0

        if scenario == 'generator_failure':
            # Diesel is offline; solar/wind unchanged
            pass

        # --- Load ---
        # Base + heating (heating rises sharply when temp << −5°C) + daily rhythm
        base_load   = 150.0 + station.num_occupants * 2
        heating_kw  = max(0.0, (-5.0 - temp_c) * 5.5)
        # Daily usage envelope: lower overnight, peaks ~10:00 and ~18:00
        diurnal     = 30 * math.sin(math.pi * (hour - 6) / 12) if 6 <= hour <= 20 else -20
        total_load  = base_load + heating_kw + diurnal + random.gauss(0, 8)
        total_load  = max(80, total_load)

        if scenario == 'high_demand':
            total_load *= 1.45
        elif scenario == 'polar_night':
            total_load += 60   # extra heating

        # --- Battery & Diesel dispatch (energy balance) ---
        battery_soc = self._soc_state.get(sid, 72.0)
        fuel_level  = self._fuel_state.get(sid, 80.0)

        renewable_total = solar_kw + wind_kw
        deficit = total_load - renewable_total

        battery_kw = 0.0
        diesel_kw  = 0.0

        if deficit > 0:
            # Use battery first (above 25% SOC floor, max 120 kW discharge)
            if battery_soc > 25:
                battery_kw = min(deficit, 120.0, (battery_soc - 25) / 100 * station.capacity_battery_kwh)
                deficit -= battery_kw
            # Then diesel (unless generator failure)
            if deficit > 0 and scenario != 'generator_failure':
                diesel_kw = min(deficit, station.capacity_diesel_kw)
        else:
            # Excess renewable → charge battery (max 80 kW)
            surplus = abs(deficit)
            if battery_soc < 95:
                battery_kw = -min(surplus, 80.0)  # negative = charging

        # Override for low_battery scenario
        if scenario == 'low_battery':
            battery_soc = random.uniform(12, 20)
        if scenario == 'low_fuel':
            fuel_level = random.uniform(6, 14)

        # Update persistent state
        delta_soc = (battery_kw / station.capacity_battery_kwh) * 100 * 5 / 3600
        self._soc_state[sid] = max(0, min(100, battery_soc - delta_soc))

        fuel_consumed_liters = diesel_kw * 0.25 * 5 / 3600  # 0.25 L/kWh, 5 s interval
        fuel_consumed_pct    = (fuel_consumed_liters / station.fuel_tank_liters) * 100
        new_fuel = fuel_level - fuel_consumed_pct
        if new_fuel < 0:
            new_fuel = 100.0  # refuelled
        self._fuel_state[sid] = new_fuel

        # --- Derived metrics ---
        renewable_pct = (renewable_total / total_load * 100) if total_load > 0 else 100.0
        renewable_pct = min(100.0, renewable_pct)
        efficiency    = 85 + random.gauss(0, 3)
        carbon_avoided_kg = renewable_total * 0.82 / 1000  # tonne → kg per kWh
        co2_emissions_kg  = diesel_kw  * 0.82 / 1000

        return {
            "station_id":           station.id,
            "timestamp":            timestamp.isoformat(),
            "total_load_kw":        round(total_load, 2),
            "solar_kw":             round(solar_kw, 2),
            "wind_kw":              round(wind_kw, 2),
            "battery_kw":           round(battery_kw, 2),
            "diesel_kw":            round(diesel_kw, 2),
            "battery_soc_pct":      round(battery_soc, 1),
            "fuel_level_pct":       round(fuel_level, 1),
            "renewable_pct":        round(renewable_pct, 1),
            "efficiency_pct":       round(max(70, min(98, efficiency)), 1),
            "temperature_c":        temp_c,
            "wind_speed_kmh":       wind_speed,
            "solar_irradiance_wm2": round(irradiance, 1),
            "cloud_coverage_pct":   round(cloud_pct, 1),
            "carbon_avoided_kg":    round(carbon_avoided_kg, 3),
            "co2_emissions_kg":     round(co2_emissions_kg, 3),
            "conditions":           self._weather_label(wind_speed, cloud_pct, scenario),
        }

    def _weather_label(self, wind: float, cloud: float, scenario: str) -> str:
        if scenario == 'storm':
            return "Blizzard"
        if wind > 55:
            return "Severe Storm"
        if wind > 35:
            return "Windy"
        if cloud > 75:
            return "Overcast"
        if cloud > 40:
            return "Partly Cloudy"
        return "Clear"

    # ── Bulk history generator ────────────────────────────────────────────────

    def generate_history(self, station, days: int = 90) -> list:
        """Generate `days` × 24 hourly readings with realistic continuity."""
        readings = []
        now   = datetime.utcnow()
        start = now - timedelta(days=days)

        # Reset state for fresh history
        self._soc_state[station.id]  = 80.0
        self._fuel_state[station.id] = 90.0

        battery_soc = 80.0
        fuel_level  = 90.0

        for i in range(days * 24):
            ts = start + timedelta(hours=i)
            r  = self.generate_reading(station, ts, scenario='normal')

            # Apply running SOC / fuel tracking for continuity
            delta_soc = (r['battery_kw'] / station.capacity_battery_kwh) * 100
            battery_soc = max(0, min(100, battery_soc - delta_soc))
            fuel_consumed = r['diesel_kw'] * 0.25 / station.fuel_tank_liters * 100
            fuel_level -= fuel_consumed
            if fuel_level < 5:
                fuel_level = 95.0   # simulated refuel event

            r['battery_soc_pct'] = round(battery_soc, 1)
            r['fuel_level_pct']  = round(fuel_level, 1)
            readings.append(r)

        return readings

    # ── Forecast generator ────────────────────────────────────────────────────

    def generate_forecast(self, station, hours: int = 24,
                          scenario: str = 'normal') -> list:
        """Generate forecast readings with increasing uncertainty."""
        forecast = []
        now = datetime.utcnow()
        for h in range(1, hours + 1):
            ts = now + timedelta(hours=h)
            r  = self.generate_reading(station, ts, scenario)
            noise = 1 + random.gauss(0, 0.03 * math.sqrt(h))
            r['total_load_kw']    = round(r['total_load_kw'] * noise, 2)
            r['predicted']        = True
            r['horizon_hours']    = h
            r['confidence']       = max(0.5, 0.95 - h * 0.015)
            forecast.append(r)
        return forecast

    # ── Weather-only ─────────────────────────────────────────────────────────

    def get_weather(self, station, timestamp: datetime,
                    scenario: str = 'normal') -> dict:
        month      = timestamp.month
        hour       = timestamp.hour
        cloud_pct  = random.uniform(10, 40)
        if scenario == 'storm':
            cloud_pct = random.uniform(80, 100)
        wind_speed = self._wind_speed(scenario)
        temp_c     = self._ambient_temperature(station.latitude, month, scenario)
        irradiance = self._solar_irradiance(
            station.latitude, month, hour, cloud_pct, scenario)

        return {
            "temperature_c":        temp_c,
            "wind_speed_kmh":       wind_speed,
            "wind_direction_deg":   round(random.uniform(0, 360), 1),
            "solar_irradiance_wm2": round(irradiance, 1),
            "cloud_coverage_pct":   round(cloud_pct, 1),
            "humidity_pct":         round(random.uniform(55, 90), 1),
            "conditions":           self._weather_label(wind_speed, cloud_pct, scenario),
            "storm_warning":        2 if scenario == 'storm' else (1 if wind_speed > 55 else 0),
        }

    def get_weather_forecast(self, station, days: int = 7,
                              scenario: str = 'normal') -> list:
        """7-day weather forecast."""
        forecast = []
        now = datetime.utcnow()
        for d in range(1, days + 1):
            ts = now + timedelta(days=d)
            w  = self.get_weather(station, ts, scenario)
            w['date'] = ts.date().isoformat()
            w['day_name'] = ts.strftime('%A')
            forecast.append(w)
        return forecast
