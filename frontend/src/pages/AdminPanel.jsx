import { useState } from 'react'
import { Users, MapPin, ClipboardList, Shield } from 'lucide-react'

const DEMO_USERS = [
  { id: 1, full_name: 'Admin Commander',   email: 'admin@ncpor.res.in',    role: 'ADMIN',            status: 'ACTIVE',   last_login: '2026-09-29T18:32:00' },
  { id: 2, full_name: 'Station Operator',  email: 'operator@ncpor.res.in', role: 'STATION_OPERATOR', status: 'ACTIVE',   last_login: '2026-09-29T15:10:00' },
  { id: 3, full_name: 'Research Analyst',  email: 'research@ncpor.res.in', role: 'RESEARCHER',       status: 'INACTIVE', last_login: '2026-09-28T09:44:00' },
]

const DEMO_STATIONS = [
  { id: 1, name: 'Maitri Station',  location: 'Queen Maud Land, Antarctica',    is_active: true,  capacity_kw: 200, commissioned: '2023-01-15' },
  { id: 2, name: 'Bharati Station', location: 'Larsemann Hills, East Antarctica', is_active: true,  capacity_kw: 160, commissioned: '2023-06-01' },
  { id: 3, name: 'Himadri Station', location: 'Ny-Ålesund, Svalbard, Arctic',   is_active: false, capacity_kw: 120, commissioned: '2022-08-10' },
]

const DEMO_AUDIT = [
  { id: 10, user: 'admin@ncpor.res.in',    action: 'LOGIN',               resource: 'Auth',          ts: '2026-09-29T18:32:11' },
  { id: 9,  user: 'operator@ncpor.res.in', action: 'UPDATE_THRESHOLD',    resource: 'Station #1',    ts: '2026-09-29T17:55:02' },
  { id: 8,  user: 'admin@ncpor.res.in',    action: 'EXPORT_CSV',          resource: 'Reports',       ts: '2026-09-29T17:22:48' },
  { id: 7,  user: 'operator@ncpor.res.in', action: 'TOGGLE_DEMO_MODE',    resource: 'Settings',      ts: '2026-09-29T16:44:33' },
  { id: 6,  user: 'admin@ncpor.res.in',    action: 'CREATE_USER',         resource: 'User #3',       ts: '2026-09-29T15:10:05' },
  { id: 5,  user: 'research@ncpor.res.in', action: 'VIEW_REPORTS',        resource: 'Reports',       ts: '2026-09-28T09:44:22' },
  { id: 4,  user: 'admin@ncpor.res.in',    action: 'DEACTIVATE_STATION',  resource: 'Station #3',    ts: '2026-09-28T08:30:15' },
  { id: 3,  user: 'operator@ncpor.res.in', action: 'LOGIN',               resource: 'Auth',          ts: '2026-09-27T14:12:44' },
  { id: 2,  user: 'admin@ncpor.res.in',    action: 'UPDATE_CAPACITY',     resource: 'Station #2',    ts: '2026-09-27T11:05:30' },
  { id: 1,  user: 'admin@ncpor.res.in',    action: 'SEED_DEMO_DATA',      resource: 'Database',      ts: '2026-09-26T08:00:00' },
]

const ROLE_PILL = {
  ADMIN:            { cls: 'pill pill-cyan',   label: 'ADMIN' },
  STATION_OPERATOR: { cls: 'pill pill-green',  label: 'OPERATOR' },
  RESEARCHER:       { cls: 'pill pill-amber',  label: 'RESEARCHER' },
  VIEWER:           { cls: 'pill pill-dim',    label: 'VIEWER' },
}

const ACTION_COLOR = {
  LOGIN:             '#10B981',
  LOGOUT:            '#475569',
  CREATE_USER:       '#06B6D4',
  EXPORT_CSV:        '#8B5CF6',
  UPDATE_THRESHOLD:  '#F59E0B',
  TOGGLE_DEMO_MODE:  '#F59E0B',
  DEACTIVATE_STATION:'#EF4444',
  UPDATE_CAPACITY:   '#06B6D4',
  VIEW_REPORTS:      '#94A3B8',
  SEED_DEMO_DATA:    '#8B5CF6',
}

function SectionHeader({ icon: Icon, title, count, accent }) {
  const colors = { cyan: '#06B6D4', green: '#10B981', amber: '#F59E0B', purple: '#8B5CF6' }
  const c = colors[accent] || '#06B6D4'
  return (
    <div style={{ padding: '15px 20px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: c + '14', border: `1px solid ${c}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={c} />
      </div>
      <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: '0.9rem', color: '#E2E8F0' }}>{title}</span>
      <span style={{ marginLeft: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#334155' }}>{count} records</span>
    </div>
  )
}

function fmtTs(ts) {
  try { return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return ts }
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Administration</span>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Admin Panel
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          User management, station control, and system audit log
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#101827', border: '1px solid #1E293B', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {[
          { key: 'users',    label: 'Users',     icon: Users },
          { key: 'stations', label: 'Stations',  icon: MapPin },
          { key: 'audit',    label: 'Audit Log', icon: ClipboardList },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: '0.8rem', fontFamily: 'Space Grotesk', fontWeight: 600, letterSpacing: '0.04em',
              transition: 'all 0.15s',
              background: activeTab === key ? '#06B6D4' : 'transparent',
              color: activeTab === key ? '#0A0F1A' : '#475569',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="pg-card pg-card-cyan" style={{ overflow: 'hidden' }}>
          <SectionHeader icon={Users} title="Registered Users" count={DEMO_USERS.length} accent="cyan" />
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_USERS.map(u => {
                  const rp = ROLE_PILL[u.role] || ROLE_PILL.VIEWER
                  return (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155', fontSize: '0.75rem' }}>{u.id}</td>
                      <td style={{ color: '#E2E8F0', fontWeight: 500 }}>{u.full_name}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#94A3B8' }}>{u.email}</td>
                      <td><span className={rp.cls}>{rp.label}</span></td>
                      <td>
                        <span className={u.status === 'ACTIVE' ? 'pill pill-green' : 'pill pill-dim'}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#475569' }}>
                        {fmtTs(u.last_login)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stations Table */}
      {activeTab === 'stations' && (
        <div className="pg-card pg-card-green" style={{ overflow: 'hidden' }}>
          <SectionHeader icon={MapPin} title="Research Stations" count={DEMO_STATIONS.length} accent="green" />
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Station Name</th>
                  <th>Location</th>
                  <th>Capacity</th>
                  <th>Commissioned</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_STATIONS.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155', fontSize: '0.75rem' }}>{s.id}</td>
                    <td style={{ color: '#E2E8F0', fontWeight: 500 }}>{s.name}</td>
                    <td style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{s.location}</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#06B6D4', fontSize: '0.82rem' }}>{s.capacity_kw} kW</td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#475569' }}>{s.commissioned}</td>
                    <td>
                      <span className={s.is_active ? 'pill pill-green' : 'pill pill-dim'}>
                        {s.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && (
        <div className="pg-card pg-card-amber" style={{ overflow: 'hidden' }}>
          <SectionHeader icon={ClipboardList} title="Audit Log" count={DEMO_AUDIT.length} accent="amber" />
          <div style={{ overflowX: 'auto' }}>
            <table className="pg-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_AUDIT.map(a => {
                  const ac = ACTION_COLOR[a.action] || '#94A3B8'
                  return (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#334155', fontSize: '0.75rem' }}>{a.id}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#475569' }}>{fmtTs(a.ts)}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#94A3B8' }}>{a.user}</td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          color: ac,
                          background: ac + '14',
                          border: `1px solid ${ac}30`,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>
                          {a.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#E2E8F0' }}>{a.resource}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hardcoded note */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Shield size={12} color="#334155" />
        <span style={{ fontSize: '0.68rem', color: '#334155' }}>
          Showing seeded demo data — 3 users, 3 stations, 10 audit events
        </span>
      </div>
    </div>
  )
}
