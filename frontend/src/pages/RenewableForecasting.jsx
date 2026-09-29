import { useQuery } from '@tanstack/react-query'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import Card from '../components/common/Card'

const TT = {
  contentStyle: { background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#94A3B8' },
  itemStyle: { color: '#E2E8F0' },
  cursor: { stroke: '#1E293B' },
}

export default function RenewableForecasting() {
  const { currentStationId } = useStationStore()

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['renewable-forecast', currentStationId],
    queryFn: () =>
      api.get(`/api/renewable/forecast?station_id=${currentStationId}&hours=24`).then(r => r.data),
    refetchInterval: 15000,
  })

  // Response: {predictions: [{timestamp, solar_kw, wind_kw, renewable_total_kw, ...}], summary}
  const predictions = forecast?.predictions ?? []

  const chartData = predictions.map(d => ({
    time: d.timestamp ? d.timestamp.slice(11, 16) : '',
    solar_kw: d.solar_kw,
    wind_kw: d.wind_kw,
    renewable_total_kw: d.renewable_total_kw,
  }))

  // Peak solar = max solar_kw in predictions
  const solarPeak = predictions.length > 0
    ? Math.max(...predictions.map(d => d.solar_kw ?? 0))
    : null
  // Peak wind = max wind_kw in predictions
  const windPeak = predictions.length > 0
    ? Math.max(...predictions.map(d => d.wind_kw ?? 0))
    : null

  const total = predictions.length || 1
  const hoursWithSolar = predictions.filter(d => (d.solar_kw ?? 0) > 0).length
  const hoursWithWind = predictions.filter(d => (d.wind_kw ?? 0) > 0).length
  const solarCovPct = ((hoursWithSolar / total) * 100).toFixed(1)
  const windCovPct = ((hoursWithWind / total) * 100).toFixed(1)

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">AI Forecasting</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Renewable Forecast
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Solar &amp; Wind generation prediction · 24h horizon · Auto-refreshes every 15s
        </p>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Solar */}
        <div className="pg-card" style={{ padding: '20px 24px', borderTop: '2px solid #F59E0B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>☀️</span>
            <p style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Forecast Solar Peak
            </p>
          </div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#E2E8F0', lineHeight: 1 }}>
            {solarPeak !== null ? Number(solarPeak).toFixed(1) : '—'}
            <span style={{ fontSize: '0.85rem', color: '#475569', marginLeft: 6 }}>kW</span>
          </p>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>Generation coverage</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#F59E0B' }}>{solarCovPct}%</span>
            </div>
            <div style={{ height: 4, background: '#1E293B', borderRadius: 2 }}>
              <div style={{ width: `${solarCovPct}%`, height: '100%', background: '#F59E0B', borderRadius: 2 }} />
            </div>
          </div>
        </div>

        {/* Wind */}
        <div className="pg-card" style={{ padding: '20px 24px', borderTop: '2px solid #06B6D4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>💨</span>
            <p style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Forecast Wind Peak
            </p>
          </div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#E2E8F0', lineHeight: 1 }}>
            {windPeak !== null ? Number(windPeak).toFixed(1) : '—'}
            <span style={{ fontSize: '0.85rem', color: '#475569', marginLeft: 6 }}>kW</span>
          </p>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.7rem', color: '#475569' }}>Generation coverage</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#06B6D4' }}>{windCovPct}%</span>
            </div>
            <div style={{ height: 4, background: '#1E293B', borderRadius: 2 }}>
              <div style={{ width: `${windCovPct}%`, height: '100%', background: '#06B6D4', borderRadius: 2 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ComposedChart: Solar + Wind */}
      <Card title="24-Hour Generation Forecast" subtitle="Solar (amber) · Wind (cyan) — kW" accent="amber" noPadding>
        <div style={{ padding: '0 18px 18px' }}>
          {isLoading ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.85rem' }}>
              Loading forecast…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#162032" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#334155', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#334155', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip {...TT} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: '#94A3B8', paddingTop: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="solar_kw"
                  name="Solar"
                  stroke="#F59E0B"
                  fill="#F59E0B10"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="wind_kw"
                  name="Wind"
                  stroke="#06B6D4"
                  fill="#06B6D410"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Coverage Analysis */}
      <div style={{ marginTop: 20 }}>
        <Card title="Coverage Analysis" subtitle="Productive generation hours in 24h window" accent="green" noPadding>
          <div style={{ padding: '18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Hours Solar > 0 kW', hours: hoursWithSolar, pct: solarCovPct, color: '#F59E0B' },
                { label: 'Hours Wind > 0 kW', hours: hoursWithWind, pct: windCovPct, color: '#06B6D4' },
              ].map(item => (
                <div key={item.label} style={{ background: '#0D1523', borderRadius: 6, padding: '16px' }}>
                  <p style={{ fontSize: '0.72rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    {item.label}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.8rem', fontWeight: 700, color: '#E2E8F0' }}>
                      {item.hours}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#475569' }}>of {total} hours</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', color: item.color, marginLeft: 'auto' }}>
                      {item.pct}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: '#1E293B', borderRadius: 4 }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
