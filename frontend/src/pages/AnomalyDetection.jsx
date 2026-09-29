import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import useStationStore from '../store/stationStore'
import api from '../services/api'
import Card from '../components/common/Card'

const SEV_CONFIG = {
  LOW: { color: '#10B981', bg: '#10B98122' },
  MEDIUM: { color: '#F59E0B', bg: '#F59E0B22' },
  HIGH: { color: '#EF4444', bg: '#EF444422' },
  CRITICAL: { color: '#8B5CF6', bg: '#8B5CF622' },
}

function normSev(s = '') {
  return s.toUpperCase()
}

function SevPill({ severity }) {
  const cfg = SEV_CONFIG[normSev(severity)] || { color: '#94A3B8', bg: '#94A3B822' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.4px',
      background: cfg.bg,
      color: cfg.color,
      textTransform: 'uppercase',
      border: `1px solid ${cfg.color}44`,
    }}>
      {severity || 'N/A'}
    </span>
  )
}

const FILTERS = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export default function AnomalyDetection() {
  const { currentStationId } = useStationStore()
  const [activeFilter, setActiveFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['anomalies', currentStationId],
    queryFn: () => api.get(`/api/anomalies?station_id=${currentStationId}&hours=168`).then(r => r.data),
    refetchInterval: 15000,
  })

  // API returns a list directly
  const anomalies = Array.isArray(data) ? data : (data?.anomalies ?? [])

  const filtered = useMemo(() => {
    if (activeFilter === 'ALL') return anomalies
    return anomalies.filter(a => normSev(a.severity) === activeFilter)
  }, [anomalies, activeFilter])

  // Summary stats
  const now = Date.now()
  const today = anomalies.filter(a => {
    const t = a.timestamp ? new Date(a.timestamp).getTime() : 0
    return now - t < 86400000
  })
  // is_resolved is a boolean field
  const resolved = anomalies.filter(a => a.is_resolved === true)
  const critical = anomalies.filter(a => normSev(a.severity) === 'CRITICAL')

  const STAT_BOXES = [
    { label: 'Today', value: today.length, color: '#06B6D4' },
    { label: 'Total 7 Days', value: anomalies.length, color: '#E2E8F0' },
    { label: 'Resolved', value: resolved.length, color: '#10B981' },
    { label: 'Critical', value: critical.length, color: '#EF4444' },
  ]

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">AI Detection</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Anomaly Detection
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          AI-powered anomaly monitoring · Last 7 days · Station {currentStationId}
        </p>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {STAT_BOXES.map(s => (
          <div key={s.label} className="pg-card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '2.2rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>
              {isLoading ? '—' : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar + list */}
      <Card title="Anomaly Log" subtitle={`Showing ${filtered.length} of ${anomalies.length} anomalies`} accent="cyan">
        {/* Filter buttons */}
        <div style={{ padding: '14px 16px 0', borderBottom: '1px solid #1E293B', display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 0 }}>
          {FILTERS.map(f => {
            const cfg = SEV_CONFIG[f] || { color: '#06B6D4', bg: '#06B6D422' }
            const isActive = activeFilter === f
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 20,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.4px',
                  border: isActive ? `1px solid ${f === 'ALL' ? '#06B6D4' : cfg.color}` : '1px solid #1E293B',
                  background: isActive ? (f === 'ALL' ? '#06B6D422' : cfg.bg) : 'transparent',
                  color: isActive ? (f === 'ALL' ? '#06B6D4' : cfg.color) : '#475569',
                  cursor: 'pointer',
                  marginBottom: 14,
                  transition: 'all 0.15s',
                }}
              >
                {f}
                {f !== 'ALL' && (
                  <span style={{ marginLeft: 5, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                    ({anomalies.filter(a => normSev(a.severity) === f).length})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Anomaly rows */}
        {isLoading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading anomalies…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🤖</div>
            <div style={{ fontSize: '0.82rem', color: '#10B981' }}>No anomalies detected for this filter</div>
          </div>
        ) : (
          <div style={{ padding: '8px 0 8px' }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr 100px 1fr 90px 80px 120px',
              gap: 12,
              padding: '6px 16px',
              borderBottom: '1px solid #1E293B',
            }}>
              {['Timestamp', 'Component', 'Severity', 'Description', 'Deviation', 'Status', 'Detection Method'].map(h => (
                <div key={h} style={{ fontSize: '0.65rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>{h}</div>
              ))}
            </div>

            {filtered.map((a, i) => {
              const sev = normSev(a.severity)
              const cfg = SEV_CONFIG[sev] || { color: '#94A3B8', bg: '#94A3B822' }
              // is_resolved is a boolean
              const isResolved = a.is_resolved === true
              return (
                <div
                  key={a.id ?? i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr 100px 1fr 90px 80px 120px',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: '1px solid #1E293B',
                    background: i % 2 === 0 ? 'transparent' : '#0D152308',
                    alignItems: 'center',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#141E2E'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'transparent'}
                >
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#475569' }}>
                    {a.timestamp ? new Date(a.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 500 }}>
                    {a.component || 'Unknown'}
                  </div>
                  <div><SevPill severity={a.severity} /></div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.4 }}>
                    {a.description || '—'}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: cfg.color, fontWeight: 600 }}>
                    {a.deviation_pct != null ? `${a.deviation_pct > 0 ? '+' : ''}${Number(a.deviation_pct).toFixed(1)}%` : '—'}
                  </div>
                  <div>
                    {isResolved ? (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10B981', background: '#10B98122', padding: '2px 7px', borderRadius: 10, border: '1px solid #10B98144' }}>
                        RESOLVED
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#F59E0B', background: '#F59E0B22', padding: '2px 7px', borderRadius: 10, border: '1px solid #F59E0B44' }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'JetBrains Mono, monospace' }}>
                    {a.detection_method || '—'}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
