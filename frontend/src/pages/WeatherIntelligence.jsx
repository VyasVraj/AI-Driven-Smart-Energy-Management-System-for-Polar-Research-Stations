import { useQuery } from '@tanstack/react-query'
import useStationStore from '../store/stationStore'
import api from '../services/api'
import Card from '../components/common/Card'

const WX_ICONS = {
  sunny: '☀️', clear: '☀️', cloudy: '☁️', overcast: '☁️',
  rainy: '🌧️', rain: '🌧️', stormy: '⛈️', storm: '⛈️',
  windy: '🌬️', foggy: '🌫️', fog: '🌫️', snow: '❄️', snowy: '❄️',
  partly_cloudy: '⛅', 'partly cloudy': '⛅', haze: '🌫️', hazy: '🌫️',
}

function wxIcon(condition = '') {
  const key = condition.toLowerCase().replace(/\s+/g, '_')
  return WX_ICONS[key] || WX_ICONS[condition.toLowerCase()] || '🌤️'
}

function conditionColor(condition = '') {
  const c = condition.toLowerCase()
  if (c.includes('storm') || c.includes('rain')) return '#06B6D4'
  if (c.includes('cloud') || c.includes('overcast')) return '#94A3B8'
  if (c.includes('fog') || c.includes('haze')) return '#475569'
  if (c.includes('snow')) return '#E2E8F0'
  return '#F59E0B'
}

function stormLabel(val) {
  if (val === 2) return '⚠️ STORM WARNING'
  if (val === 1) return '⚡ Storm Watch'
  return null
}

export default function WeatherIntelligence() {
  const { currentStationId } = useStationStore()

  const { data: current, isLoading: loadingCurrent } = useQuery({
    queryKey: ['weather-current', currentStationId],
    queryFn: () => api.get(`/api/weather/current?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: forecast, isLoading: loadingForecast } = useQuery({
    queryKey: ['weather-forecast', currentStationId],
    queryFn: () => api.get(`/api/weather/forecast?station_id=${currentStationId}&days=7`).then(r => r.data),
    refetchInterval: 60000,
  })

  const cond = current?.conditions || ''
  const cc = conditionColor(cond)
  const stormWarn = stormLabel(current?.storm_warning)

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Environmental Intelligence</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Weather Intelligence
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Real-time environmental monitoring · Station {currentStationId}
        </p>
      </div>

      {/* Storm warning banner */}
      {stormWarn && (
        <div style={{
          background: '#EF444420', border: '1px solid #EF444450', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, color: '#EF4444', fontSize: '0.82rem', fontWeight: 600,
        }}>
          {stormWarn}
        </div>
      )}

      {/* Top row: Current conditions + mini stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Current conditions */}
        <Card title="Current Conditions" accent="cyan">
          {loadingCurrent ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading…</div>
          ) : (
            <div style={{ padding: '20px 22px 22px' }}>
              {/* Top: big temp + condition */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '4.2rem', fontWeight: 700, color: '#E2E8F0', lineHeight: 1 }}>
                    {current?.temperature_c ?? '--'}
                    <span style={{ fontSize: '2rem', color: '#94A3B8' }}>°C</span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 20,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      background: cc + '22',
                      color: cc,
                      border: `1px solid ${cc}44`,
                      textTransform: 'uppercase',
                    }}>
                      {wxIcon(cond)} {cond || 'N/A'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '4rem', lineHeight: 1 }}>{wxIcon(cond)}</div>
              </div>

              {/* Stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Solar Irradiance', value: current?.solar_irradiance_wm2 ?? '--', unit: 'W/m²', accent: '#F59E0B' },
                  { label: 'Wind Speed', value: current?.wind_speed_kmh ?? '--', unit: 'km/h', accent: '#06B6D4' },
                  { label: 'Wind Direction', value: current?.wind_direction_deg ?? '--', unit: '°', accent: '#8B5CF6' },
                  { label: 'Humidity', value: current?.humidity_pct ?? '--', unit: '%', accent: '#10B981' },
                  { label: 'Cloud Cover', value: current?.cloud_coverage_pct ?? '--', unit: '%', accent: '#94A3B8' },
                  { label: 'Storm Warning', value: current?.storm_warning ?? 0, unit: '', accent: current?.storm_warning > 0 ? '#EF4444' : '#475569' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#0D1523', borderRadius: 6, padding: '10px 14px', border: '1px solid #1E293B' }}>
                    <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 600, color: s.accent }}>
                      {s.value}<span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: 2 }}>{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Solar & wind detail */}
        <Card title="Solar & Wind Analysis" accent="amber">
          {loadingCurrent ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading…</div>
          ) : (
            <div style={{ padding: '20px 22px' }}>
              {/* Solar Irradiance bar */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Solar Irradiance</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#F59E0B' }}>
                    {current?.solar_irradiance_wm2 ?? '--'} W/m²
                  </span>
                </div>
                <div style={{ height: 6, background: '#0D1523', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, ((current?.solar_irradiance_wm2 ?? 0) / 1200) * 100)}%`, background: '#F59E0B', borderRadius: 3 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: '0.65rem', color: '#334155' }}>0</span>
                  <span style={{ fontSize: '0.65rem', color: '#334155' }}>1200 W/m²</span>
                </div>
              </div>

              {/* Wind */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Wind Speed</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#06B6D4' }}>
                    {current?.wind_speed_kmh ?? '--'} km/h
                  </span>
                </div>
                <div style={{ height: 6, background: '#0D1523', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, ((current?.wind_speed_kmh ?? 0) / 120) * 100)}%`, background: '#06B6D4', borderRadius: 3 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <span style={{ fontSize: '0.65rem', color: '#334155' }}>Calm</span>
                  <span style={{ fontSize: '0.65rem', color: '#334155' }}>Storm (120 km/h)</span>
                </div>
              </div>

              {/* Humidity */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Humidity</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#10B981' }}>
                    {current?.humidity_pct ?? '--'}%
                  </span>
                </div>
                <div style={{ height: 6, background: '#0D1523', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, current?.humidity_pct ?? 0)}%`, background: '#10B981', borderRadius: 3 }} />
                </div>
              </div>

              {/* Cloud Cover */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Cloud Cover</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#94A3B8' }}>
                    {current?.cloud_coverage_pct ?? '--'}%
                  </span>
                </div>
                <div style={{ height: 6, background: '#0D1523', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, current?.cloud_coverage_pct ?? 0)}%`, background: '#94A3B8', borderRadius: 3 }} />
                </div>
              </div>

              {/* Last updated */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #1E293B', fontSize: '0.7rem', color: '#334155' }}>
                Last updated: {current?.timestamp ? new Date(current.timestamp).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 7-day forecast */}
      <Card title="7-Day Forecast" subtitle="Daily outlook with conditions" accent="cyan">
        {loadingForecast ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading forecast…</div>
        ) : !Array.isArray(forecast) || forecast.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>No forecast data available</div>
        ) : (
          <div style={{ padding: '4px 16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
              {forecast.slice(0, 7).map((day, i) => {
                const cond_ = day.conditions || ''
                const ic = wxIcon(cond_)
                const cc_ = conditionColor(cond_)
                const dayLabel = day.day_name || (day.date ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }) : `D${i + 1}`)
                return (
                  <div key={i} style={{
                    background: '#0D1523',
                    border: '1px solid #1E293B',
                    borderTop: `2px solid ${cc_}`,
                    borderRadius: 8,
                    padding: '14px 10px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                      {i === 0 ? 'Today' : dayLabel}
                    </div>
                    <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{ic}</div>
                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.2rem', fontWeight: 700, color: '#E2E8F0', marginBottom: 2 }}>
                      {day.temperature_c ?? '--'}°
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#06B6D4', marginBottom: 6 }}>
                      💨 {day.wind_speed_kmh ?? '--'} km/h
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: 10,
                      fontSize: '0.6rem',
                      fontWeight: 600,
                      background: cc_ + '22',
                      color: cc_,
                      border: `1px solid ${cc_}33`,
                      textTransform: 'capitalize',
                    }}>
                      {cond_ || 'N/A'}
                    </div>
                    {day.storm_warning > 0 && (
                      <div style={{ fontSize: '0.65rem', color: '#EF4444', marginTop: 6 }}>
                        ⚠️ Storm {day.storm_warning === 2 ? 'Warning' : 'Watch'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
