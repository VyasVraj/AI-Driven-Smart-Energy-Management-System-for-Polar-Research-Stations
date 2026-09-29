import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import Card from '../components/common/Card'

const TT = {
  contentStyle: { background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6, fontSize: 12 },
  labelStyle:   { color: '#94A3B8' },
  itemStyle:    { color: '#E2E8F0' },
  cursor:       { fill: '#1A2540' },
}

function fuelColor(pct) {
  if (pct >= 50) return '#10B981'
  if (pct >= 25) return '#F59E0B'
  return '#EF4444'
}

function KpiCard({ label, value, unit, accent = '#06B6D4', sub }) {
  return (
    <div className="pg-card" style={{ padding: '20px', borderTop: `2px solid ${accent}` }}>
      <p style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '2rem', fontWeight: 700, color: accent, lineHeight: 1 }}>
        {value ?? '—'}
        <span style={{ fontSize: '0.85rem', color: '#334155', marginLeft: 6 }}>{unit}</span>
      </p>
      {sub && <p style={{ fontSize: '0.72rem', color: '#475569', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

export default function FuelManagement() {
  const { currentStationId } = useStationStore()

  const { data: fuelStatus, isLoading } = useQuery({
    queryKey: ['fuel-status', currentStationId],
    queryFn: () => api.get(`/api/fuel/status?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: consumption, isLoading: consLoading } = useQuery({
    queryKey: ['fuel-consumption', currentStationId],
    queryFn: () => api.get(`/api/fuel/consumption?station_id=${currentStationId}&days=14`).then(r => r.data),
    refetchInterval: 30000,
  })

  // ── Correct field names from /api/fuel/status ──
  const tankLevel   = fuelStatus?.fuel_level_pct                 ?? null
  const fuelLiters  = fuelStatus?.fuel_liters                    ?? null
  const tankCap     = fuelStatus?.tank_capacity_liters           ?? null
  const daysLeft    = fuelStatus?.days_remaining                 ?? null
  const ratePerHour = fuelStatus?.consumption_rate_lh            ?? null
  const ratePerDay  = fuelStatus?.consumption_rate_day_liters    ?? null
  const dieselKw    = fuelStatus?.diesel_kw_current              ?? null
  const genEff      = fuelStatus?.generator_efficiency_pct       ?? null
  const genRuntime  = fuelStatus?.generator_runtime_today_hours  ?? null
  const exhaustDate = fuelStatus?.estimated_exhaustion_date      ?? null
  const severity    = fuelStatus?.severity                       ?? 'LOW'
  const recommendations = Array.isArray(fuelStatus?.recommendations) ? fuelStatus.recommendations : []

  const color = tankLevel !== null ? fuelColor(tankLevel) : '#06B6D4'

  // ── Consumption data: list of {date, consumption_liters, ...} ──
  const consList = Array.isArray(consumption) ? consumption : []
  const consData = consList.map(d => ({
    date:    (d.date || '').slice(5),             // MM-DD
    liters:  d.consumption_liters ?? d.liters ?? d.consumption ?? 0,
  }))
  const avgLiters = consData.length
    ? consData.reduce((s, d) => s + d.liters, 0) / consData.length
    : 0

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="section-label">Asset Management</span>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
            Fuel Management
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
            Diesel reserves · Consumption analytics · AI dispatch recommendations
          </p>
        </div>
        {/* Severity pill */}
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
          padding: '4px 12px', borderRadius: 4,
          background: severity === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : severity === 'LOW' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${severity === 'CRITICAL' ? 'rgba(239,68,68,0.3)' : severity === 'LOW' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
          color: severity === 'CRITICAL' ? '#EF4444' : severity === 'LOW' ? '#10B981' : '#F59E0B',
        }}>
          SEVERITY: {severity}
        </span>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
        <KpiCard
          label="Tank Level"
          value={tankLevel != null ? tankLevel.toFixed(1) : null}
          unit="%"
          accent={color}
          sub={tankLevel != null
            ? tankLevel < 25 ? '⚠ Critical — schedule resupply'
            : tankLevel < 50 ? '⚠ Low — plan refill soon'
            : '✓ Normal level'
            : null}
        />
        <KpiCard
          label="Days Remaining"
          value={daysLeft != null ? Math.round(daysLeft) : null}
          unit="days"
          accent="#F59E0B"
          sub={exhaustDate ? `Exhaustion: ${exhaustDate}` : 'At current consumption rate'}
        />
        <KpiCard
          label="Consumption Rate"
          value={ratePerHour != null ? ratePerHour.toFixed(1) : null}
          unit="L / h"
          accent="#8B5CF6"
          sub={ratePerDay != null ? `${ratePerDay.toFixed(0)} L/day · ${dieselKw != null ? dieselKw.toFixed(0) + ' kW gen' : ''}` : null}
        />
      </div>

      {/* Secondary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Fuel in Tank',   value: fuelLiters != null ? `${(fuelLiters/1000).toFixed(1)}k` : '—', unit: 'L',  color: color },
          { label: 'Tank Capacity',  value: tankCap   != null ? `${(tankCap/1000).toFixed(0)}k`    : '—', unit: 'L',  color: '#475569' },
          { label: 'Gen Efficiency', value: genEff    != null ? genEff.toFixed(1)                   : '—', unit: '%',  color: '#06B6D4' },
          { label: 'Runtime Today',  value: genRuntime != null ? genRuntime.toFixed(1)              : '—', unit: 'h',  color: '#94A3B8' },
        ].map(item => (
          <div key={item.label} style={{ background: '#101827', border: '1px solid #1E293B', borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ fontSize: '0.62rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              {item.label}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color: item.color }}>
              {item.value}
              <span style={{ fontSize: '0.68rem', color: '#334155', marginLeft: 4 }}>{item.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tank visual */}
      <div className="pg-card" style={{ padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: '0.85rem', fontWeight: 600, color: '#E2E8F0' }}>
            Tank Level Indicator
          </span>
          <div style={{ display: 'flex', gap: 14 }}>
            {[['#EF4444','Critical <25%'],['#F59E0B','Low 25–50%'],['#10B981','Normal >50%']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: '0.65rem', color: '#475569' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', height: 38, background: '#0D1523', borderRadius: 6, border: '1px solid #1E293B', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, tankLevel ?? 0))}%`,
            height: '100%', background: color, borderRadius: 5, transition: 'width 0.8s ease',
          }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9rem', fontWeight: 700, color: '#E2E8F0', textShadow: '0 1px 4px #000' }}>
              {tankLevel != null ? `${tankLevel.toFixed(1)}%` : '—'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          {[0, 25, 50, 75, 100].map(t => (
            <span key={t} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#273548' }}>{t}%</span>
          ))}
        </div>
      </div>

      {/* 14-day bar chart */}
      <Card title="14-Day Fuel Consumption" subtitle="Daily diesel usage (litres) — red bars = above average" accent="amber" noPadding>
        <div style={{ padding: '4px 12px 16px' }}>
          {consLoading ? (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
              Loading consumption data…
            </div>
          ) : consData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '0.82rem' }}>
              No consumption data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={consData} margin={{ top: 14, right: 10, left: -10, bottom: 0 }} barSize={16}>
                <CartesianGrid stroke="#162032" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} unit=" L" />
                <Tooltip {...TT} formatter={v => [`${v.toFixed(0)} L`, 'Consumed']} />
                <ReferenceLine y={avgLiters} stroke="#F59E0B40" strokeDasharray="5 4"
                  label={{ value: 'Avg', fill: '#F59E0B', fontSize: 9, position: 'insideTopRight' }} />
                <Bar dataKey="liters" name="Litres" radius={[3, 3, 0, 0]}>
                  {consData.map((entry, i) => (
                    <Cell key={i} fill={entry.liters > avgLiters * 1.15 ? '#EF4444' : '#F59E0B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* AI Recommendations */}
      <Card title="AI Fuel Recommendations" subtitle="Dispatch model optimization suggestions" accent="purple" noPadding style={{ marginTop: 16 }}>
        <div style={{ padding: '16px 18px' }}>
          {recommendations.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#334155', fontSize: '0.82rem' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>💡</div>
              Fuel is at normal levels — no urgent recommendations from the AI at this time.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recommendations.map((rec, i) => (
                <div key={i} style={{
                  background: '#0D1523', border: '1px solid #1E293B',
                  borderLeft: '3px solid #8B5CF6', borderRadius: 6,
                  padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#8B5CF6', minWidth: 22, paddingTop: 1 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p style={{ fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.55 }}>{rec}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
