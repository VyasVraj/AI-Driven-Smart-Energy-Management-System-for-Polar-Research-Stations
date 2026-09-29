import { useQuery } from '@tanstack/react-query'
import { Zap, Sun, Battery, Droplets, ShieldAlert, RefreshCw, Clock } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts'
import { useEffect, useMemo } from 'react'
import Card from '../components/common/Card'
import KPICard from '../components/dashboard/KPICard'
import EnergyFlowDiagram from '../components/dashboard/EnergyFlowDiagram'
import GaugeChart from '../components/common/GaugeChart'
import LoadingSpinner from '../components/common/LoadingSpinner'
import useStationStore from '../store/stationStore'
import useEnergyStore from '../store/energyStore'
import api from '../services/api'

/* ── Tooltip style ──────────────────────────────────────────────────── */
const TT = {
  contentStyle: { background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6, fontSize: 12 },
  labelStyle:   { color: '#94A3B8' },
  itemStyle:    { color: '#E2E8F0' },
  cursor:       { stroke: '#1E293B' },
}

/* ── Seeded chart data (stable per hour) ───────────────────────────── */
function stableRand(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function buildLoadData() {
  const r = stableRand(Date.now() % 86400000 | 0)
  return Array.from({ length: 24 }, (_, i) => ({
    t: `${String(i).padStart(2, '0')}:00`,
    actual:    Math.round(220 + r() * 160),
    predicted: Math.round(215 + r() * 150),
  }))
}

function buildFuelData() {
  const r = stableRand(42)
  return Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    liters: Math.round(90 + r() * 60),
  }))
}

/* ── Page header ────────────────────────────────────────────────────── */
function PageHeader({ station, lastUpdate, onRefresh, loading }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <span className="section-label">Command Center</span>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          {station || 'Maitri Station'}
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={12} />
          Last updated: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('en-GB', { hour12: false }) : '—'}
          &nbsp;·&nbsp;Refreshes every 5s
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="sim-badge">⚠ Simulation Data</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn-ghost"
          style={{ gap: 6 }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>
    </div>
  )
}

/* ── Source breakdown bar ───────────────────────────────────────────── */
function SourceBar({ solar, wind, battery, diesel, total }) {
  const pcts = [
    { label: 'Solar',   value: solar,   color: '#F59E0B' },
    { label: 'Wind',    value: wind,    color: '#06B6D4' },
    { label: 'Battery', value: Math.max(0, battery), color: '#10B981' },
    { label: 'Diesel',  value: diesel,  color: '#475569' },
  ].filter(s => s.value > 0)

  return (
    <div style={{ marginTop: 14 }}>
      {/* Bar */}
      <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: '#141E2E', gap: 1 }}>
        {pcts.map(s => (
          <div
            key={s.label}
            title={`${s.label}: ${Math.round(s.value)} kW`}
            style={{ flex: s.value, background: s.color, minWidth: 2, transition: 'flex 0.5s ease' }}
          />
        ))}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        {pcts.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            <span style={{ fontSize: '0.68rem', color: '#475569' }}>
              {s.label} <span style={{ color: s.color, fontWeight: 600 }}>{Math.round(total ? s.value / total * 100 : 0)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── AI Rec item ────────────────────────────────────────────────────── */
function RecItem({ title, desc, impact, color }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 6,
      background: '#0D1523',
      border: `1px solid ${color}22`,
      borderLeft: `3px solid ${color}`,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <span style={{ fontFamily: 'Space Grotesk', fontSize: '0.82rem', fontWeight: 600, color: '#E2E8F0' }}>
          {title}
        </span>
        {impact && (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', marginLeft: 8 }}>
            {impact}
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.5 }}>{desc}</p>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────────────────── */
export default function CommandCenter() {
  const { currentStationId } = useStationStore()
  const { currentReading, setCurrentReading, lastUpdate } = useEnergyStore()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['energy-current', currentStationId],
    queryFn: () => api.get(`/api/energy/current?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 5000,
  })

  const { data: stationData } = useQuery({
    queryKey: ['stations-list'],
    queryFn: () => api.get('/api/stations').then(r => r.data),
    staleTime: 60000,
  })

  const { data: riskData } = useQuery({
    queryKey: ['risk-current', currentStationId],
    queryFn: () => api.get(`/api/risk/current?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: optData } = useQuery({
    queryKey: ['opt-rec', currentStationId],
    queryFn: () => api.get(`/api/optimization/recommendation?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 30000,
  })

  useEffect(() => { if (data) setCurrentReading(data) }, [data, setCurrentReading])

  const d          = currentReading || data
  const stationName = stationData?.find(s => s.id === currentStationId)?.name || 'Maitri Station'
  const riskLevel  = riskData?.level || 'LOW'
  const riskScore  = riskData?.score ?? 0
  const riskColor  = { LOW: '#10B981', MEDIUM: '#F59E0B', HIGH: '#F97316', CRITICAL: '#EF4444' }[riskLevel] || '#10B981'

  const renewableKw    = (d?.solar_kw || 0) + (d?.wind_kw || 0)
  const renewablePct   = d?.renewable_pct || 0
  const fuelDaysLeft   = d ? Math.floor((d.fuel_level_pct / 100) * 60) : 0

  const loadData = useMemo(() => buildLoadData(), [])
  const fuelData = useMemo(() => buildFuelData(), [])

  if (isLoading && !d) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <PageHeader
        station={stationName}
        lastUpdate={lastUpdate}
        onRefresh={refetch}
        loading={isLoading}
      />

      {/* ── KPI Row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <KPICard
          title="Total Load" value={Math.round(d?.total_load_kw || 0)} unit="kW"
          icon={Zap} color="cyan" trend={2.4}
        />
        <KPICard
          title="Renewable" value={Math.round(renewableKw)} unit="kW"
          subtitle={`${renewablePct.toFixed(1)}% of total`}
          icon={Sun} color="green" trend={5.1}
        />
        <KPICard
          title="Battery SOC" value={(d?.battery_soc_pct || 0).toFixed(1)} unit="%"
          icon={Battery} color="amber" trend={-1.2}
        />
        <KPICard
          title="Fuel Level" value={(d?.fuel_level_pct || 0).toFixed(1)} unit="%"
          subtitle={`~${fuelDaysLeft} days remaining`}
          icon={Droplets} color="purple"
        />
        <KPICard
          title="Risk Level" value={riskLevel} unit=""
          subtitle={`Score: ${riskScore.toFixed(0)} / 100`}
          icon={ShieldAlert}
          color={riskLevel === 'LOW' ? 'green' : riskLevel === 'MEDIUM' ? 'amber' : 'red'}
        />
      </div>

      {/* ── Energy Mix Bar ──────────────────────────────────────────── */}
      <Card noPadding accent="none" style={{ marginBottom: 20 }}>
        <div style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: '0.82rem', fontWeight: 600, color: '#E2E8F0' }}>
              Live Energy Mix
            </span>
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>
              Total: <span style={{ color: '#06B6D4', fontWeight: 600 }}>{Math.round(d?.total_load_kw || 0)} kW</span>
            </span>
          </div>
          <SourceBar
            solar={d?.solar_kw || 0}
            wind={d?.wind_kw || 0}
            battery={d?.battery_kw || 0}
            diesel={d?.diesel_kw || 0}
            total={d?.total_load_kw || 1}
          />
        </div>
      </Card>

      {/* ── Main Row — Flow + Forecast ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>

        {/* Energy flow */}
        <Card title="Real-Time Energy Flow" subtitle="Live power distribution" accent="cyan" noPadding>
          <div style={{ height: 310, padding: '8px 12px 4px' }}>
            <EnergyFlowDiagram data={d} />
          </div>
        </Card>

        {/* 24h Forecast */}
        <Card title="24h Load Forecast" subtitle="Actual vs. predicted demand" accent="cyan" noPadding>
          <div style={{ height: 310, padding: '12px 8px 4px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={loadData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#162032" />
                <XAxis dataKey="t" tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} interval={5} />
                <YAxis tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...TT} />
                <Area type="monotone" dataKey="actual" stroke="#06B6D4"
                  strokeWidth={1.5} fill="#06B6D410" dot={false} name="Actual" />
                <Area type="monotone" dataKey="predicted" stroke="#F59E0B"
                  strokeWidth={1.5} strokeDasharray="5 4" fill="none" dot={false} name="Predicted" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Bottom Row — Battery + Fuel + AI Rec ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Battery gauge */}
        <Card title="Battery Status" subtitle="State of charge" accent="green" noPadding>
          <div style={{ padding: '20px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <GaugeChart value={d?.battery_soc_pct || 0} size={160} label="State of Charge" />
            </div>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Power', value: `${Math.abs(Math.round(d?.battery_kw || 0))} kW`, sub: d?.battery_kw < 0 ? 'Charging' : 'Discharging' },
                { label: 'Est. Backup', value: `${Math.round((d?.battery_soc_pct || 0) / 100 * 8)} h`, sub: 'at current load' },
              ].map(item => (
                <div key={item.label} style={{ background: '#0D1523', borderRadius: 5, padding: '10px 12px', border: '1px solid #162032' }}>
                  <div style={{ fontSize: '0.65rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: '1rem', fontWeight: 700, color: '#10B981' }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Fuel trend */}
        <Card title="Fuel Consumption" subtitle="7-day diesel usage (L/day)" accent="amber" noPadding>
          <div style={{ padding: '4px 8px 8px' }}>
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fuelData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#162032" />
                  <XAxis dataKey="day" tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...TT} cursor={{ fill: '#1A2540' }} />
                  <Bar dataKey="liters" fill="#F59E0B" radius={[3, 3, 0, 0]} name="Liters" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Fuel stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, padding: '0 10px' }}>
              {[
                { label: 'Tank Level', value: `${(d?.fuel_level_pct || 0).toFixed(1)}%`, color: (d?.fuel_level_pct || 100) < 25 ? '#EF4444' : '#F59E0B' },
                { label: 'Days Left', value: `~${fuelDaysLeft}d`, color: '#F59E0B' },
              ].map(item => (
                <div key={item.label} style={{ background: '#0D1523', borderRadius: 5, padding: '10px 12px', border: '1px solid #162032' }}>
                  <div style={{ fontSize: '0.65rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: '1rem', fontWeight: 700, color: item.color }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* AI Recommendations */}
        <Card title="AI Recommendations" subtitle="Optimization engine output" accent="cyan" noPadding>
          <div style={{ padding: '14px 14px', maxHeight: 310, overflowY: 'auto' }}>
            {optData?.explanation?.slice(0, 3).map((tip, i) => (
              <RecItem
                key={i}
                title={['Dispatch Priority', 'Battery Strategy', 'Fuel Conservation'][i] || 'Recommendation'}
                desc={tip}
                color={['#06B6D4', '#10B981', '#F59E0B'][i] || '#06B6D4'}
                impact={i === 0 ? `${optData.expected_savings?.diesel_liters?.toFixed(1) || 0} L/h saved` : null}
              />
            )) || (
              <>
                <RecItem title="Optimize Heating Load" color="#10B981"
                  desc="Shift non-critical heating by 2h to align with peak solar. Estimated -15L diesel/day."
                  impact="-15L/day" />
                <RecItem title="Battery Pre-Charge" color="#F59E0B"
                  desc="Pre-charge battery to 90% SOC ahead of forecast low-wind period starting in 6h." />
                <RecItem title="Renewable Priority" color="#06B6D4"
                  desc="Current wind output sufficient to cover lab loads. Diesel standby only — save fuel." />
              </>
            )}

            {/* Optimizer dispatch summary */}
            {optData && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#0D1523', borderRadius: 5, border: '1px solid #162032' }}>
                <div style={{ fontSize: '0.65rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Current Dispatch Split
                </div>
                {[
                  { label: 'Solar', pct: optData.solar_pct,   color: '#F59E0B' },
                  { label: 'Wind',  pct: optData.wind_pct,    color: '#06B6D4' },
                  { label: 'Batt',  pct: optData.battery_pct, color: '#10B981' },
                  { label: 'Diesel',pct: optData.diesel_pct,  color: '#475569' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: '0.68rem', color: '#475569', minWidth: 36 }}>{s.label}</span>
                    <div style={{ flex: 1, height: 4, background: '#141E2E', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.68rem', color: s.color, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>
                      {s.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
