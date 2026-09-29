import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import LoadingSpinner from '../components/common/LoadingSpinner'

/* ── Static metadata keyed by numeric station ID ─────────────────── */
const META = {
  1: { flag: '🇮🇳', region: 'Queen Maud Land, Antarctica', coords: '70°45′S 11°44′E', since: 1989, code: 'MAIT' },
  2: { flag: '🇮🇳', region: 'Prydz Bay, East Antarctica',  coords: '69°24′S 76°11′E', since: 2012, code: 'BHAR' },
  3: { flag: '🇮🇳', region: 'Ny-Ålesund, Svalbard, Arctic',coords: '78°55′N 11°56′E', since: 2008, code: 'HIMA' },
}

/* ── Risk badge ──────────────────────────────────────────────────── */
const RISK_STYLE = {
  LOW:      { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  color: '#10B981', label: 'LOW RISK'  },
  MEDIUM:   { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', color: '#F59E0B', label: 'MED RISK'  },
  HIGH:     { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  color: '#EF4444', label: 'HIGH RISK' },
  CRITICAL: { bg: 'rgba(239,68,68,0.15)', border: '#EF4444',               color: '#EF4444', label: 'CRITICAL'  },
}

function RiskBadge({ level }) {
  const s = RISK_STYLE[level] || RISK_STYLE.LOW
  return (
    <span style={{
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
      fontFamily: 'JetBrains Mono, monospace',
      borderRadius: 4, padding: '3px 8px',
    }}>
      {s.label}
    </span>
  )
}

/* ── Mini progress bar ───────────────────────────────────────────── */
function MiniBar({ label, value, display, color }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.67rem', color: '#475569' }}>{label}</span>
        <span style={{ fontSize: '0.67rem', color: color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          {display}
        </span>
      </div>
      <div style={{ height: 3, background: '#1E293B', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

/* ── Station card ────────────────────────────────────────────────── */
function StationCard({ station, isActive, onSelect }) {
  const meta   = META[station.id] || {}
  const live   = station.live || {}
  const risk   = station.risk_level || 'LOW'

  return (
    <div
      onClick={() => onSelect(station.id)}
      style={{
        background: '#101827',
        border: `1px solid ${isActive ? '#06B6D4' : '#1E293B'}`,
        borderTop: `2px solid ${isActive ? '#06B6D4' : '#1E293B'}`,
        borderRadius: 8,
        padding: 20,
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = '#273548' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = '#1E293B' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.4rem' }}>{meta.flag || '🏔️'}</span>
            <div>
              <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#E2E8F0', margin: 0, lineHeight: 1 }}>
                {station.name}
              </h3>
              <span style={{ fontSize: '0.62rem', color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
                {meta.code}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#475569' }}>{meta.region}</div>
          <div style={{ fontSize: '0.63rem', color: '#334155', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
            {meta.coords}
          </div>
        </div>
        <RiskBadge level={risk} />
      </div>

      {/* Active indicator */}
      {isActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
          <span style={{ fontSize: '0.63rem', color: '#10B981', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
            ACTIVE STATION
          </span>
        </div>
      )}

      {/* Metrics bars — using live.* fields */}
      <div style={{ borderTop: '1px solid #1E293B', paddingTop: 12 }}>
        <MiniBar
          label="Current Load"
          value={(live.total_load_kw || 0) / (station.capacity_diesel_kw + 100) * 100}
          display={`${Math.round(live.total_load_kw || 0)} kW`}
          color="#06B6D4"
        />
        <MiniBar
          label="Renewable"
          value={live.renewable_pct || 0}
          display={`${(live.renewable_pct || 0).toFixed(1)}%`}
          color="#10B981"
        />
        <MiniBar
          label="Battery SOC"
          value={live.battery_soc_pct || 0}
          display={`${(live.battery_soc_pct || 0).toFixed(0)}%`}
          color="#8B5CF6"
        />
        <MiniBar
          label="Fuel Level"
          value={live.fuel_level_pct || 0}
          display={`${(live.fuel_level_pct || 0).toFixed(0)}%`}
          color={live.fuel_level_pct < 25 ? '#EF4444' : '#F59E0B'}
        />
      </div>

      {/* Info chips */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Personnel', value: station.num_occupants ?? '—' },
          { label: 'Est. Since', value: meta.since ?? '—' },
          { label: 'Status', value: station.is_active ? 'ONLINE' : 'OFFLINE', color: station.is_active ? '#10B981' : '#EF4444' },
        ].map(item => (
          <div key={item.label} style={{ background: '#0D1523', border: '1px solid #1E293B', borderRadius: 5, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.58rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
              {item.label}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: item.color || '#E2E8F0' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Live weather snippet */}
      <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: '#475569', borderTop: '1px solid #1E293B', paddingTop: 10 }}>
        <span>🌡 <span style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{live.temperature_c?.toFixed(1) ?? '—'}°C</span></span>
        <span>💨 <span style={{ color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{live.wind_speed_kmh?.toFixed(0) ?? '—'} km/h</span></span>
        <span>🌥 <span style={{ color: '#94A3B8' }}>{live.conditions ?? 'Unknown'}</span></span>
      </div>

      {/* Select button */}
      <button
        className={isActive ? 'btn-cyan' : 'btn-outline'}
        onClick={e => { e.stopPropagation(); onSelect(station.id) }}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        {isActive ? '✓ Currently Selected' : 'Select Station →'}
      </button>
    </div>
  )
}

/* ── Summary stat box ────────────────────────────────────────────── */
function StatBox({ label, value, color }) {
  return (
    <div style={{ background: '#101827', border: '1px solid #1E293B', borderRadius: 8, padding: '14px 20px', flex: 1 }}>
      <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.5rem', fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  )
}

/* ── Page ────────────────────────────────────────────────────────── */
export default function StationOverview() {
  const { currentStationId, setCurrentStationId } = useStationStore()

  const { data: stations, isLoading, error } = useQuery({
    queryKey: ['stations'],
    queryFn: () => api.get('/api/stations').then(r => r.data),
    refetchInterval: 15000,
  })

  // API returns a list directly
  const list = Array.isArray(stations) ? stations : []

  const avgRenewable = list.length
    ? (list.reduce((a, s) => a + (s.live?.renewable_pct || 0), 0) / list.length).toFixed(0)
    : '—'
  const highRisk = list.filter(s => s.risk_level === 'HIGH' || s.risk_level === 'CRITICAL').length

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Station Management</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Research Stations
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          India's polar research network — click any card to switch active station
        </p>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <StatBox label="Total Stations"  value={list.length || 3}  color="#06B6D4" />
        <StatBox label="Online"          value={list.filter(s => s.is_active !== false).length || 3} color="#10B981" />
        <StatBox label="High Risk"       value={highRisk}           color={highRisk > 0 ? '#EF4444' : '#10B981'} />
        <StatBox label="Avg Renewable"   value={`${avgRenewable}%`} color="#10B981" />
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, padding: '12px 18px', marginBottom: 16,
          color: '#EF4444', fontSize: '0.8rem',
        }}>
          ⚠ Could not reach API — check that the backend is running on port 8000.
        </div>
      )}

      {/* Station cards */}
      {!isLoading && list.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {list.map(station => (
            <StationCard
              key={station.id}
              station={station}
              isActive={currentStationId === station.id}
              onSelect={id => setCurrentStationId(id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && list.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📡</div>
          <p>No stations found. Check the backend connection.</p>
        </div>
      )}
    </div>
  )
}
