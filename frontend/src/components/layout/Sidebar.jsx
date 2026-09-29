import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Layers, LayoutDashboard, MapPin, Zap, TrendingUp, Sun, Target,
  Battery, Fuel, Cloud, ShieldAlert, AlertTriangle, FlaskConical,
  Cpu, BrainCircuit, FileText, BarChart3, Bell, Settings, Users, LogOut,
} from 'lucide-react'
import { NAV_ITEMS } from '../../utils/constants'
import useAuthStore from '../../store/authStore'
import useDemoStore from '../../store/demoStore'

const ICONS = {
  LayoutDashboard, MapPin, Zap, TrendingUp, Sun, Target, Battery, Fuel,
  Cloud, ShieldAlert, AlertTriangle, FlaskConical, Cpu, BrainCircuit,
  FileText, BarChart3, Bell, Settings, Users,
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { isDemoMode } = useDemoStore()

  const groups = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div
      className="pg-sidebar"
      style={{
        width: 260,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 22px',
        borderBottom: '1px solid #1E293B',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Layers icon box */}
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: '#06B6D414',
          border: '1px solid #06B6D430',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Layers size={16} color="#06B6D4" />
        </div>

        <div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: '#06B6D4', fontSize: '0.95rem', letterSpacing: '-0.3px', lineHeight: 1 }}>
            POLARIS
          </div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 500, color: '#E2E8F0', fontSize: '0.72rem', letterSpacing: '0.1em', marginTop: 2 }}>
            ENERGY AI
          </div>
        </div>

        {/* Demo mode badge */}
        {isDemoMode && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 5,
            background: '#10B98110',
            border: '1px solid #10B98128',
            borderRadius: 4, padding: '3px 8px',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#10B981', display: 'inline-block',
            }} />
            <span style={{ fontSize: '0.6rem', color: '#10B981', fontWeight: 700, letterSpacing: '0.1em' }}>
              LIVE
            </span>
          </div>
        )}
      </div>

      {/* ── Nav Groups ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName} style={{ marginBottom: 2 }}>
            {/* Group label */}
            <div style={{
              padding: '10px 20px 4px',
              fontSize: '0.6rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: '#334155',
            }}>
              {groupName}
            </div>

            {items.map(item => {
              const Icon = ICONS[item.icon]
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path))

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 20px',
                    fontSize: '0.83rem',
                    textDecoration: 'none',
                    position: 'relative',
                    transition: 'all 0.15s',
                    color: isActive ? '#06B6D4' : '#475569',
                    background: isActive ? '#06B6D412' : 'transparent',
                    borderRight: isActive ? '2px solid #06B6D4' : '2px solid transparent',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#E2E8F0'
                      e.currentTarget.style.background = '#141E2E'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#475569'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {Icon && (
                    <Icon
                      size={15}
                      style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65 }}
                    />
                  )}
                  <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── User / Logout ──────────────────────────────────────────── */}
      <div style={{
        padding: '14px 18px',
        borderTop: '1px solid #1E293B',
      }}>
        {/* Avatar + name + role row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#06B6D414',
            border: '1px solid #06B6D430',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Space Grotesk', fontWeight: 700, color: '#06B6D4', fontSize: '0.78rem',
            flexShrink: 0,
          }}>
            {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: '#E2E8F0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Space Grotesk' }}>
              {user?.full_name || user?.email?.split('@')[0] || 'Commander'}
            </div>
            <div style={{ fontSize: '0.62rem', color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 1 }}>
              {user?.role || 'ADMIN'}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              background: 'none', border: 'none',
              color: '#475569', cursor: 'pointer', padding: 4,
              transition: 'color 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Footer label */}
        <div style={{ fontSize: '0.58rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
          Ministry of Earth Sciences · NCPOR
        </div>
      </div>
    </div>
  )
}
