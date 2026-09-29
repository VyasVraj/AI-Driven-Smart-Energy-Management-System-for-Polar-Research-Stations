import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

function KpiCard({ label, value, unit, accent = '#06B6D4', sub }) {
  return (
    <div className="pg-card" style={{ padding: '20px 24px', borderTop: `2px solid ${accent}` }}>
      <p style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#E2E8F0', lineHeight: 1 }}>
        {value ?? '—'}
        <span style={{ fontSize: '0.85rem', color: '#475569', marginLeft: 6 }}>{unit}</span>
      </p>
      {sub && <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

function StatPanel({ label, value, unit }) {
  return (
    <div className="pg-card" style={{ padding: '18px 20px', flex: 1 }}>
      <p style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: '#E2E8F0' }}>
        {value ?? '—'}
        <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: 5 }}>{unit}</span>
      </p>
    </div>
  )
}

export default function EnergyMonitoring() {
  const { currentStationId } = useStationStore()

  const { data: history, isLoading } = useQuery({
    queryKey: ['energy-history', currentStationId],
    queryFn: () =>
      api.get(`/api/energy/history?station_id=${currentStationId}&hours=48`).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: status } = useQuery({
    queryKey: ['energy-status', currentStationId],
    queryFn: () =>
      api.get(`/api/energy/status?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 15000,
  })

  // history is the list directly — no nested .data wrapper
  const rawHistory = Array.isArray(history) ? history : []

  // Map to chart-friendly keys, x-axis = HH:MM from timestamp
  const chartData = rawHistory.map(d => ({
    time: d.timestamp ? d.timestamp.slice(11, 16) : '',
    solar_kw: d.solar_kw,
    wind_kw: d.wind_kw,
    diesel_kw: d.diesel_kw,
    battery_kw: d.battery_kw,
    total_load_kw: d.total_load_kw,
  }))

  // Derive summary stats from history list
  const latestRow = rawHistory.length > 0 ? rawHistory[rawHistory.length - 1] : null
  const currentLoad = latestRow?.total_load_kw ?? null
  const renewablePct = latestRow?.renewable_pct ?? null
  const avgEff = rawHistory.length > 0
    ? (rawHistory.reduce((s, d) => s + (d.efficiency_pct ?? 0), 0) / rawHistory.length)
    : null
  const peakLoad = rawHistory.length > 0
    ? Math.max(...rawHistory.map(d => d.total_load_kw ?? 0))
    : null

  // Status endpoint for CO2 (if available)
  const co2Avoided = status?.co2_avoided_kg ?? status?.co2_avoided ?? null
  const totalKwh = status?.total_kwh ?? status?.total_consumed_kwh ?? null

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Energy Intelligence</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Energy Monitoring
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Real-time telemetry · 48h historical view · Auto-refreshes every 15s
        </p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <KpiCard
          label="Current Load"
          value={currentLoad !== null ? Number(currentLoad).toFixed(1) : null}
          unit="kW"
          accent="#06B6D4"
          sub="Station demand right now"
        />
        <KpiCard
          label="Renewable % (latest)"
          value={renewablePct !== null ? Number(renewablePct).toFixed(1) : null}
          unit="%"
          accent="#10B981"
          sub="Solar + wind share of generation"
        />
        <KpiCard
          label="CO₂ Avoided"
          value={co2Avoided !== null ? Number(co2Avoided).toFixed(1) : null}
          unit="kg"
          accent="#8B5CF6"
          sub="vs. diesel-only baseline"
        />
      </div>

      {/* 48h Area Chart */}
      <Card title="48-Hour Energy History" subtitle="Solar · Wind · Diesel · Battery (kW)" accent="cyan" noPadding>
        <div style={{ padding: '0 18px 18px' }}>
          {isLoading ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.85rem' }}>
              Loading chart data…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
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
                  strokeWidth={1.5}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="wind_kw"
                  name="Wind"
                  stroke="#06B6D4"
                  fill="#06B6D410"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="diesel_kw"
                  name="Diesel"
                  stroke="#EF4444"
                  fill="#EF444410"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="battery_kw"
                  name="Battery"
                  stroke="#10B981"
                  fill="#10B98110"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
        <StatPanel label="Peak Load (48h)" value={peakLoad !== null ? Number(peakLoad).toFixed(1) : null} unit="kW" />
        <StatPanel label="Average Efficiency" value={avgEff !== null ? Number(avgEff).toFixed(1) : null} unit="%" />
        <StatPanel label="Total Consumed" value={totalKwh !== null ? Number(totalKwh).toFixed(0) : null} unit="kWh" />
      </div>
    </div>
  )
}
