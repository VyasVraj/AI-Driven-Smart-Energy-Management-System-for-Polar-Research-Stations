import { useEffect, useState } from 'react'
import { Bell, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useDemoStore from '../../store/demoStore'
import useAuthStore from '../../store/authStore'
import useStationStore from '../../store/stationStore'

const STATIONS = [
  { id: 1, name: 'Maitri',   location: 'Queen Maud Land' },
  { id: 2, name: 'Bharati',  location: 'East Antarctica' },
  { id: 3, name: 'Himadri',  location: 'Svalbard, Arctic' },
]

export default function TopBar() {
  const [time,   setTime]   = useState(new Date())
  const [online, setOnline] = useState(true)

  const { isDemoMode, setDemoMode } = useDemoStore()
  const { user } = useAuthStore()
  const { currentStationId, setCurrentStationId } = useStationStore()
  const navigate = useNavigate()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    const o = setInterval(() => setOnline(prev => prev || Math.random() > 0.01), 5000)
    return () => { clearInterval(t); clearInterval(o) }
  }, [])

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'Commander'
  const initials    = (user?.full_name?.[0] || user?.email?.[0] || 'C').toUpperCase()
  const role        = user?.role || 'ADMIN'

  return (
    <div
      className="pg-topbar"
      style={{
        height: 60,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* ── LEFT ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Station selector */}
        <div style={{ position: 'relative' }}>
          <select
            className="pg-select"
            value={currentStationId}
            onChange={e => setCurrentStationId(Number(e.target.value))}
            style={{
              appearance: 'none',
              paddingRight: 30,
              minWidth: 200,
              fontFamily: 'Space Grotesk',
              fontWeight: 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            {STATIONS.map(s => (
              <option key={s.id} value={s.id} style={{ background: '#101827' }}>
                {s.name} — {s.location}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: '#1E293B' }} />

        {/* Live clock */}
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: '#94A3B8', letterSpacing: '0.06em' }}>
          {time.toLocaleTimeString('en-GB', { hour12: false })}
          <span style={{ color: '#334155', marginLeft: 6, fontSize: '0.72rem' }}>UTC</span>
        </div>

        {/* ONLINE pill */}
        <span
          className={online ? 'pill pill-green' : 'pill pill-red'}
          style={{ fontSize: '0.68rem', letterSpacing: '0.1em' }}
        >
          {online ? '● ONLINE' : '● OFFLINE'}
        </span>

      </div>

      {/* ── RIGHT ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Sim badge */}
        <span className="sim-badge">⚠ SIMULATION DATA</span>

        {/* SIMULATOR toggle */}
        <button
          onClick={() => setDemoMode(!isDemoMode)}
          style={{
            padding: '5px 14px',
            borderRadius: 4,
            fontSize: '0.72rem',
            fontWeight: 700,
            fontFamily: 'Space Grotesk',
            letterSpacing: '0.1em',
            cursor: 'pointer',
            border: isDemoMode ? '1px solid #F59E0B50' : '1px solid #1E293B',
            background: isDemoMode ? '#F59E0B14' : '#141E2E',
            color: isDemoMode ? '#F59E0B' : '#475569',
            transition: 'all 0.2s',
          }}
        >
          SIMULATOR {isDemoMode ? 'ON' : 'OFF'}
        </button>

        {/* Bell icon with badge */}
        <button
          onClick={() => navigate('/alerts')}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            color: '#94A3B8',
            cursor: 'pointer',
            padding: 4,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#E2E8F0'}
          onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
        >
          <Bell size={17} />
          <span style={{
            position: 'absolute', top: 0, right: 0,
            width: 16, height: 16,
            background: '#EF4444',
            borderRadius: '50%',
            fontSize: '0.6rem', fontWeight: 700,
            color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid #0A0F1A',
            fontFamily: 'JetBrains Mono, monospace',
          }}>3</span>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: '#1E293B' }} />

        {/* User info + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#E2E8F0', lineHeight: 1, fontFamily: 'Space Grotesk' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#06B6D4', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {role}
            </div>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#06B6D414',
            border: '1px solid #06B6D430',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Space Grotesk', fontWeight: 700, color: '#06B6D4', fontSize: '0.8rem',
            flexShrink: 0,
          }}>
            {initials}
          </div>
        </div>

      </div>
    </div>
  )
}
