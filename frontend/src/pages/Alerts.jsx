import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import useStationStore from '../store/stationStore'
import api from '../services/api'
import Card from '../components/common/Card'

const SEV = {
  CRITICAL: { color: '#EF4444', bg: '#EF444415', border: '#EF4444', label: 'CRITICAL' },
  HIGH: { color: '#F59E0B', bg: '#F59E0B15', border: '#F59E0B', label: 'HIGH' },
  MEDIUM: { color: '#06B6D4', bg: '#06B6D415', border: '#06B6D4', label: 'MEDIUM' },
  LOW: { color: '#10B981', bg: '#10B98115', border: '#10B981', label: 'LOW' },
  INFO: { color: '#8B5CF6', bg: '#8B5CF615', border: '#8B5CF6', label: 'INFO' },
}

function getSev(s = '') {
  return SEV[s.toUpperCase()] || SEV.INFO
}

const FILTER_OPTIONS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

function timeAgo(ts) {
  if (!ts) return 'N/A'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Alerts() {
  const { currentStationId } = useStationStore()
  const queryClient = useQueryClient()
  const [sevFilter, setSevFilter] = useState('ALL')
  const [showUnacked, setShowUnacked] = useState(false)
  const [ackingId, setAckingId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', currentStationId],
    queryFn: () => api.get(`/api/alerts?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 10000,
  })

  const ackMutation = useMutation({
    mutationFn: (id) => api.post(`/api/alerts/${id}/acknowledge`).then(r => r.data),
    onMutate: (id) => setAckingId(id),
    onSettled: () => {
      setAckingId(null)
      queryClient.invalidateQueries({ queryKey: ['alerts', currentStationId] })
    },
  })

  const alerts = data?.alerts ?? data ?? []

  const filtered = useMemo(() => {
    let list = alerts
    if (sevFilter !== 'ALL') list = list.filter(a => (a.severity || '').toUpperCase() === sevFilter)
    if (showUnacked) list = list.filter(a => !a.acknowledged)
    return list
  }, [alerts, sevFilter, showUnacked])

  const unackedCount = alerts.filter(a => !a.acknowledged).length

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Monitoring</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Active Alerts
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Real-time alert management · Station {currentStationId}
        </p>
      </div>

      {/* Count banner */}
      {!isLoading && unackedCount > 0 && (
        <div style={{
          marginBottom: 16,
          padding: '12px 18px',
          background: '#EF444410',
          border: '1px solid #EF444430',
          borderLeft: '3px solid #EF4444',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔔</span>
          <span style={{ fontSize: '0.85rem', color: '#EF4444', fontWeight: 600 }}>
            {unackedCount} unacknowledged alert{unackedCount !== 1 ? 's' : ''} require attention
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginLeft: 4 }}>
            ({alerts.length} total)
          </span>
        </div>
      )}

      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 4 }}>Severity:</span>
        {FILTER_OPTIONS.map(f => {
          const cfg = SEV[f] || { color: '#06B6D4', bg: '#06B6D415' }
          const isActive = sevFilter === f
          return (
            <button
              key={f}
              onClick={() => setSevFilter(f)}
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.3px',
                border: isActive ? `1px solid ${f === 'ALL' ? '#06B6D4' : cfg.color}` : '1px solid #1E293B',
                background: isActive ? (f === 'ALL' ? '#06B6D422' : cfg.bg) : 'transparent',
                color: isActive ? (f === 'ALL' ? '#06B6D4' : cfg.color) : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          )
        })}

        {/* Unacked toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', color: '#475569' }}>Unacknowledged only</span>
          <button
            onClick={() => setShowUnacked(v => !v)}
            style={{
              width: 38,
              height: 20,
              borderRadius: 10,
              border: 'none',
              background: showUnacked ? '#06B6D4' : '#1E293B',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 3,
              left: showUnacked ? 20 : 3,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#E2E8F0',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {isLoading ? (
        <div className="pg-card" style={{ padding: 48, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading alerts…</div>
      ) : filtered.length === 0 ? (
        <div className="pg-card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: '0.9rem', color: '#10B981', fontWeight: 600 }}>No alerts match the current filter</div>
          <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: 6 }}>All systems nominal</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((alert) => {
            const cfg = getSev(alert.severity)
            const isAcked = alert.acknowledged
            const isAcking = ackingId === alert.id
            return (
              <div
                key={alert.id || alert._id}
                style={{
                  background: '#101827',
                  border: `1px solid #1E293B`,
                  borderLeft: `3px solid ${isAcked ? '#1E293B' : cfg.border}`,
                  borderRadius: 8,
                  padding: '16px 20px',
                  opacity: isAcked ? 0.65 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* Alert header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Severity badge */}
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: 10,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.5px',
                      background: cfg.bg,
                      color: cfg.color,
                      border: `1px solid ${cfg.color}44`,
                    }}>
                      {cfg.label}
                    </span>
                    {/* Type badge */}
                    {(alert.type || alert.alert_type) && (
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 10,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        background: '#141E2E',
                        color: '#94A3B8',
                        border: '1px solid #1E293B',
                      }}>
                        {alert.type || alert.alert_type}
                      </span>
                    )}
                    {isAcked && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: '#10B981',
                        background: '#10B98115',
                        padding: '2px 8px',
                        borderRadius: 10,
                        border: '1px solid #10B98133',
                      }}>
                        ACKNOWLEDGED
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#334155' }}>
                      {timeAgo(alert.timestamp || alert.created_at)}
                    </span>
                    {!isAcked && (
                      <button
                        onClick={() => ackMutation.mutate(alert.id || alert._id)}
                        disabled={isAcking}
                        style={{
                          padding: '4px 12px',
                          borderRadius: 6,
                          border: '1px solid #06B6D4',
                          background: 'transparent',
                          color: '#06B6D4',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: isAcking ? 'not-allowed' : 'pointer',
                          opacity: isAcking ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!isAcking) e.currentTarget.style.background = '#06B6D422' }}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {isAcking ? '…' : 'Acknowledge'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#E2E8F0', marginBottom: 6 }}>
                  {alert.title || alert.name || 'Alert'}
                </div>

                {/* Message */}
                {alert.message && (
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: 8, lineHeight: 1.5 }}>
                    {alert.message}
                  </div>
                )}

                {/* Cause + Action row */}
                {(alert.cause || alert.recommended_action || alert.recommendation) && (
                  <div style={{ display: 'grid', gridTemplateColumns: alert.cause && (alert.recommended_action || alert.recommendation) ? '1fr 1fr' : '1fr', gap: 10, marginTop: 10 }}>
                    {alert.cause && (
                      <div style={{ background: '#0D1523', borderRadius: 6, padding: '8px 12px', border: '1px solid #1E293B' }}>
                        <div style={{ fontSize: '0.62rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Cause</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{alert.cause}</div>
                      </div>
                    )}
                    {(alert.recommended_action || alert.recommendation) && (
                      <div style={{ background: '#0D1523', borderRadius: 6, padding: '8px 12px', border: '1px solid #06B6D433' }}>
                        <div style={{ fontSize: '0.62rem', color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Recommended Action</div>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{alert.recommended_action || alert.recommendation}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp full */}
                {(alert.timestamp || alert.created_at) && (
                  <div style={{ marginTop: 10, fontSize: '0.65rem', color: '#334155' }}>
                    {new Date(alert.timestamp || alert.created_at).toLocaleString()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
