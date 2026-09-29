import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import useStationStore from '../store/stationStore'
import api from '../services/api'
import Card from '../components/common/Card'

const TT = {
  contentStyle: { background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#94A3B8' },
  itemStyle: { color: '#E2E8F0' },
  cursor: { stroke: '#1E293B' },
}

const PERIODS = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
]

function fmt(val, decimals = 1) {
  if (val == null || val === '') return '—'
  return Number(val).toFixed(decimals)
}

export default function Analytics() {
  const { currentStationId } = useStationStore()
  const [period, setPeriod] = useState('30d')

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['analytics-summary', currentStationId, period],
    queryFn: () => api.get(`/api/analytics/summary?station_id=${currentStationId}&period=${period}`).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: carbon, isLoading: loadingCarbon } = useQuery({
    queryKey: ['analytics-carbon', currentStationId, period],
    queryFn: () => api.get(`/api/analytics/carbon?station_id=${currentStationId}&period=${period}`).then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: effData, isLoading: loadingEff } = useQuery({
    queryKey: ['analytics-efficiency', currentStationId, period],
    queryFn: () => api.get(`/api/analytics/efficiency?station_id=${currentStationId}&period=${period}`).then(r => r.data),
    refetchInterval: 60000,
  })

  // effData is a list of {date, efficiency_pct, renewable_pct}
  const effChartData = Array.isArray(effData) ? effData : []

  // Summary uses data.totals.*
  const totals = summary?.totals ?? {}

  const SUMMARY_METRICS = [
    { key: 'energy_consumed_kwh', label: 'Energy Consumed', unit: 'kWh', color: '#06B6D4' },
    { key: 'renewable_kwh',       label: 'Renewable kWh',   unit: 'kWh', color: '#10B981' },
    { key: 'solar_kwh',           label: 'Solar kWh',       unit: 'kWh', color: '#F59E0B' },
    { key: 'wind_kwh',            label: 'Wind kWh',        unit: 'kWh', color: '#06B6D4' },
    { key: 'avg_efficiency_pct',  label: 'Avg Efficiency',  unit: '%',   color: '#8B5CF6' },
    { key: 'renewable_pct',       label: 'Renewable %',     unit: '%',   color: '#10B981' },
  ]

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span className="section-label">Data Analytics</span>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
            Analytics Dashboard
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
            Operational insights and performance trends · Station {currentStationId}
          </p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', gap: 4, background: '#0D1523', padding: '4px', borderRadius: 8, border: '1px solid #1E293B' }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                background: period === p.value ? '#06B6D4' : 'transparent',
                color: period === p.value ? '#0A0F1A' : '#94A3B8',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Metrics — from data.totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        {SUMMARY_METRICS.map(m => {
          const val = totals[m.key]
          return (
            <div key={m.key} className="pg-card" style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, lineHeight: 1.3 }}>
                {m.label}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.5rem', fontWeight: 700, color: m.color, lineHeight: 1 }}>
                {loadingSummary ? '—' : fmt(val)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#334155', marginTop: 4 }}>{m.unit}</div>
            </div>
          )
        })}
      </div>

      {/* Carbon metrics */}
      <Card title="Carbon Impact" subtitle={`Environmental performance over ${period}`} accent="green" noPadding>
        <div style={{ padding: '18px 20px 22px' }}>
          {loadingCarbon ? (
            <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', padding: '16px 0' }}>Loading carbon data…</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {/* CO2 avoided */}
              <div style={{ background: '#0D1523', borderRadius: 8, padding: '20px 22px', border: '1px solid #1E293B', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🌿</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#10B981', lineHeight: 1 }}>
                  {fmt(carbon?.co2_avoided_kg, 0)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 4 }}>kg CO₂ Avoided</div>
              </div>

              {/* CO2 emitted */}
              <div style={{ background: '#0D1523', borderRadius: 8, padding: '20px 22px', border: '1px solid #1E293B', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>💨</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#EF4444', lineHeight: 1 }}>
                  {fmt(carbon?.co2_emitted_kg, 0)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 4 }}>kg CO₂ Emitted</div>
              </div>

              {/* Trees equivalent */}
              <div style={{ background: '#0D1523', borderRadius: 8, padding: '20px 22px', border: '1px solid #1E293B', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🌳</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#10B981', lineHeight: 1 }}>
                  {fmt(carbon?.trees_equivalent, 0)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 4 }}>Trees Equivalent</div>
                <div style={{ marginTop: 10, fontSize: '0.72rem', color: '#334155' }}>
                  Annual CO₂ absorption equivalent
                </div>
              </div>

              {/* Renewable % */}
              <div style={{ background: '#0D1523', borderRadius: 8, padding: '20px 22px', border: '1px solid #1E293B', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>☀️</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '2rem', fontWeight: 700, color: '#F59E0B', lineHeight: 1 }}>
                  {fmt(carbon?.renewable_contribution_pct, 1)}%
                </div>
                <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 4 }}>Renewable Share</div>
                {/* Sustainability score */}
                {carbon?.sustainability_score != null && (
                  <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#06B6D4' }}>
                    Sustainability: {Number(carbon.sustainability_score).toFixed(1)}
                  </div>
                )}
                {/* Mini bar */}
                <div style={{ marginTop: 10, height: 6, background: '#141E2E', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, carbon?.renewable_contribution_pct ?? 0)}%`,
                    background: '#F59E0B',
                    borderRadius: 3,
                  }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Efficiency Line Chart — effData is list of {date, efficiency_pct, renewable_pct} */}
      <div style={{ marginTop: 16 }}>
        <Card title="Efficiency Trend" subtitle={`efficiency_pct & renewable_pct over ${period}`} accent="cyan" noPadding>
          <div style={{ padding: '16px 20px 20px' }}>
            {loadingEff ? (
              <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', padding: '24px 0' }}>Loading efficiency data…</div>
            ) : effChartData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.82rem', padding: '24px 0' }}>No efficiency data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={effChartData.map(d => ({
                    date: d.date ? d.date.slice(5) : '',  // MM-DD
                    efficiency_pct: d.efficiency_pct,
                    renewable_pct: d.renewable_pct,
                  }))}
                  margin={{ top: 10, right: 8, left: -10, bottom: 0 }}
                >
                  <CartesianGrid stroke="#162032" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#334155', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#334155', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    unit="%"
                  />
                  <Tooltip {...TT} />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 11, color: '#94A3B8', paddingTop: 8 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="efficiency_pct"
                    name="Efficiency %"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="renewable_pct"
                    name="Renewable %"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
