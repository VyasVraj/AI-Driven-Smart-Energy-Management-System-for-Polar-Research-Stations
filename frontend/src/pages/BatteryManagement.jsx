import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import Card from '../components/common/Card'
import GaugeChart from '../components/common/GaugeChart'

const TT = {
  contentStyle: { background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6, fontSize: 12 },
  labelStyle:   { color: '#94A3B8' },
  itemStyle:    { color: '#E2E8F0' },
  cursor:       { stroke: '#273548' },
}

function StatBox({ label, value, unit, color = '#E2E8F0', note }) {
  return (
    <div style={{ background: '#0D1523', border: '1px solid #1E293B', borderRadius: 6, padding: '14px 16px' }}>
      <p style={{ fontSize: '0.63rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.15rem', fontWeight: 700, color, lineHeight: 1 }}>
        {value ?? '—'}
        {unit && <span style={{ fontSize: '0.72rem', color: '#334155', marginLeft: 4 }}>{unit}</span>}
      </p>
      {note && <p style={{ fontSize: '0.65rem', color: '#334155', marginTop: 4 }}>{note}</p>}
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    CHARGING:    { color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
    DISCHARGING: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
    IDLE:        { color: '#06B6D4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)' },
    UNKNOWN:     { color: '#475569', bg: 'rgba(71,85,105,0.1)',   border: 'rgba(71,85,105,0.25)' },
  }
  const s = map[status] || map.UNKNOWN
  return (
    <span style={{
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
      borderRadius: 4, padding: '3px 10px',
    }}>
      {status}
    </span>
  )
}

export default function BatteryManagement() {
  const { currentStationId } = useStationStore()

  const { data: status, isLoading } = useQuery({
    queryKey: ['battery-status', currentStationId],
    queryFn: () => api.get(`/api/battery/status?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 10000,
  })

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['battery-history', currentStationId],
    queryFn: () => api.get(`/api/battery/history?station_id=${currentStationId}&hours=48`).then(r => r.data),
    refetchInterval: 30000,
  })

  // ── Correct field names from /api/battery/status ──
  const soc       = status?.soc_pct        ?? 0
  const soh       = status?.soh_pct        ?? null
  const powerKw   = status?.battery_kw     ?? null
  const tempC     = status?.temperature_c  ?? null
  const cycles    = status?.charge_cycles  ?? null
  const backupH   = status?.backup_hours   ?? null
  const capKwh    = status?.capacity_kwh   ?? null
  const availKwh  = status?.available_kwh  ?? null
  const batStatus = status?.status         ?? 'UNKNOWN'
  const safeRange = status?.is_in_safe_range ?? true
  const degrad    = status?.estimated_degradation_pct_per_year ?? null

  const gaugeColor = soc >= 60 ? '#10B981' : soc >= 25 ? '#F59E0B' : '#EF4444'

  // ── History: list of {timestamp, soc_pct, battery_kw, ...} ──
  const histList = Array.isArray(history) ? history : []
  const histData = histList.map(h => ({
    t:    (h.timestamp || '').slice(11, 16),
    soc:  h.soc_pct    ?? h.battery_soc_pct ?? 0,
    kw:   Math.abs(h.battery_kw ?? 0),
  }))

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="section-label">Asset Management</span>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
            Battery System
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
            BMS telemetry · 48h history · Auto-refreshes every 10s
          </p>
        </div>
        {batStatus && <StatusPill status={batStatus} />}
      </div>

      {/* Top Row: Gauge + Stats  |  48h Chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, marginBottom: 16 }}>

        {/* Left: Gauge + stat grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="pg-card" style={{
            padding: '24px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            borderTop: `2px solid ${gaugeColor}`,
          }}>
            <p style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>
              State of Charge
            </p>
            {isLoading ? (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
                Loading…
              </div>
            ) : (
              <GaugeChart value={soc} size={180} label="SOC" />
            )}

            {/* Safe range indicator */}
            <div style={{
              marginTop: 16, padding: '6px 14px', borderRadius: 4,
              background: safeRange ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${safeRange ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
              color: safeRange ? '#10B981' : '#EF4444',
            }}>
              {safeRange ? '✓ WITHIN SAFE RANGE' : '⚠ OUT OF SAFE RANGE'}
            </div>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatBox label="Power" value={powerKw != null ? Math.abs(powerKw).toFixed(0) : null} unit="kW"
              color={powerKw < 0 ? '#10B981' : '#F59E0B'}
              note={powerKw < 0 ? 'Charging' : powerKw > 0 ? 'Discharging' : 'Idle'} />
            <StatBox label="Backup" value={backupH != null ? backupH.toFixed(1) : null} unit="h" color="#06B6D4" note="at current load" />
            <StatBox label="Temperature" value={tempC != null ? tempC.toFixed(1) : null} unit="°C"
              color={tempC != null && tempC > 40 ? '#EF4444' : '#E2E8F0'} />
            <StatBox label="Cycles" value={cycles} color="#8B5CF6" note={degrad != null ? `${degrad}%/yr degrad.` : null} />
          </div>
        </div>

        {/* Right: 48h SOC history line chart */}
        <Card title="48-Hour SOC History" subtitle="State of charge trend (%) — last 48 hours" accent="green" noPadding>
          <div style={{ padding: '4px 12px 16px' }}>
            {histLoading ? (
              <div style={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
                Loading history…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={histData} margin={{ top: 16, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#162032" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fill: '#334155', fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip {...TT} formatter={v => [`${v}%`, 'SOC']} />
                  {/* Safe zone reference lines */}
                  <ReferenceLine y={status?.safe_min_soc ?? 20} stroke="#EF444440" strokeDasharray="4 4" label={{ value: 'Min', fill: '#EF4444', fontSize: 9 }} />
                  <ReferenceLine y={status?.safe_max_soc ?? 95} stroke="#10B98140" strokeDasharray="4 4" label={{ value: 'Max', fill: '#10B981', fontSize: 9 }} />
                  <Line type="monotone" dataKey="soc" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10B981' }} name="SOC" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Capacity info row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <StatBox label="Total Capacity" value={capKwh} unit="kWh" color="#06B6D4" />
        <StatBox label="Available Energy" value={availKwh?.toFixed(0)} unit="kWh" color="#10B981" />
        <StatBox label="Health (SoH)" value={soh?.toFixed(1)} unit="%" color={soh != null && soh < 70 ? '#EF4444' : '#E2E8F0'} />
        <StatBox label="Min / Max SOC" value={`${status?.safe_min_soc ?? 20} / ${status?.safe_max_soc ?? 95}`} unit="%" color="#475569" />
      </div>

      {/* No schedule message (API doesn't provide schedule field) */}
      <Card title="Charge Events" subtitle="Scheduled charge / discharge events" accent="purple" noPadding>
        <div style={{ padding: '28px 24px', textAlign: 'center', color: '#334155', fontSize: '0.82rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔋</div>
          Battery operating on AI dispatch control — no manual schedule active.
          <br />
          <span style={{ fontSize: '0.72rem', color: '#273548' }}>Status: <span style={{ color: batStatus === 'CHARGING' ? '#10B981' : '#F59E0B' }}>{batStatus}</span></span>
        </div>
      </Card>
    </div>
  )
}
