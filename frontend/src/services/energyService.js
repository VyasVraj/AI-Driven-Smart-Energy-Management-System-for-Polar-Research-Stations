import api from './api'

export const getMockCurrentReading = () => ({
  total_load_kw: 287 + Math.random() * 20 - 10,
  solar_kw: 65 + Math.random() * 10,
  wind_kw: 48 + Math.random() * 15,
  battery_kw: 12,
  diesel_kw: 162,
  battery_soc_pct: 71.4,
  fuel_level_pct: 63.2,
  renewable_pct: 39.3,
  efficiency_pct: 87.2,
  temperature_c: -18.5,
  wind_speed_kmh: 34.2,
  solar_irradiance_wm2: 320,
  carbon_avoided_kg: 45.2,
})

export async function getCurrentEnergy(stationId = 1) {
  try {
    const res = await api.get(`/api/energy/current?station_id=${stationId}`)
    return res.data
  } catch {
    return getMockCurrentReading()
  }
}
