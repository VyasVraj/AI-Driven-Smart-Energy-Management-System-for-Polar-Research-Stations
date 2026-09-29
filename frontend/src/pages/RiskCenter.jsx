import { useQuery } from '@tanstack/react-query'
import useStationStore from '../store/stationStore'
import api from '../services/api'
import Card from '../components/common/Card'

function getRiskLevel(score) {
  if (score >= 80) return { label: 'CRITICAL', color: '#EF4444', bg: '#EF444422' }
  if (score >= 60) return { label: 'HIGH', color: '#F59E0B', bg: '#F59E0B22' }
  if (score >= 40) return { label: 'MEDIUM', color: '#06B6D4', bg: '#06B6D422' }
  return { label: 'LOW', color: '#10B981', bg: '#10B98122' }
}

function eventBorderColor(level = '') {
  const s = level.toLowerCase()
  if (s === 'critical') return '#EF4444'
  if (s === 'high') return '#F59E0B'
  if (s === 'medium') return '#06B6D4'
  return '#10B981'
}

// factor_scores is an object: {fuel, battery, weather, renewable, demand}
const RISK_FACTORS = [
  { key: 'fuel',      label: 'Fuel Risk',      color: '#F59E0B' },
  { key: 'battery',   label: 'Battery Risk',   color: '#EF4444' },
  { key: 'weather',   label: 'Weather Risk',   color: '#06B6D4' },
  { key: 'renewable', label: 'Renewable Risk', color: '#10B981' },
  { key: 'demand',    label: 'Demand Risk',    color: '#8B5CF6' },
]

export default function RiskCenter() {
  const { currentStationId } = useStationStore()

  const { data, isLoading } = useQuery({
    queryKey: ['risk-current', currentStationId],
    queryFn: () => api.get(`/api/risk/current?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 15000,
  })

  const score = data?.score ?? 0
  const level = getRiskLevel(score)
  const events = data?.events ?? []
  const factorScores = data?.factor_scores ?? {}

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Risk Intelligence</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Risk Assessment Center
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Comprehensive operational risk monitoring · Station {currentStationId}
        </p>
      </div>

      {/* Top row */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, marginBottom: 16 }}>
        {/* Risk Score */}
        <Card title="Overall Risk Score" accent="red">
          {isLoading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading…</div>
          ) : (
            <div style={{ padding: '24px 24px 28px', textAlign: 'center' }}>
              {/* Circular-style big number */}
              <div style={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: 140,
                height: 140,
                borderRadius: '50%',
                border: `4px solid ${level.color}`,
                background: level.bg,
                marginBottom: 16,
              }}>
                <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '3rem', fontWeight: 800, color: level.color, lineHeight: 1 }}>
                  {Math.round(score)}
                </span>
                <span style={{ fontSize: '0.65rem', color: '#94A3B8', marginTop: 2 }}>/ 100</span>
              </div>

              {/* Level badge */}
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  display: 'inline-block',
                  padding: '5px 16px',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  background: level.bg,
                  color: level.color,
                  border: `1px solid ${level.color}55`,
                }}>
                  {data?.level || level.label}
                </span>
              </div>

              <p style={{ fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.5, maxWidth: 240, margin: '0 auto' }}>
                {data?.summary ?? 'No summary available.'}
              </p>

              {data?.timestamp && (
                <div style={{ marginTop: 16, fontSize: '0.68rem', color: '#334155' }}>
                  Updated: {new Date(data.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Risk Factors */}
        <Card title="Risk Factors" subtitle="Breakdown by category" accent="amber">
          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading…</div>
          ) : (
            <div style={{ padding: '18px 22px 22px' }}>
              {RISK_FACTORS.map(f => {
                const val = factorScores[f.key] ?? 0
                const pct = Math.min(100, Math.max(0, Number(val)))
                const lvl = getRiskLevel(pct)
                return (
                  <div key={f.key} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 500 }}>{f.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: f.color, fontWeight: 600 }}>
                          {pct.toFixed(0)}
                        </span>
                        <span style={{
                          padding: '1px 7px',
                          borderRadius: 10,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          background: lvl.bg,
                          color: lvl.color,
                        }}>
                          {lvl.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 8, background: '#0D1523', borderRadius: 4, overflow: 'hidden', border: '1px solid #1E293B' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: f.color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Events list */}
      <Card title="Risk Events" subtitle={`${events.length} active event${events.length !== 1 ? 's' : ''}`} accent="red">
        {isLoading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: '0.82rem' }}>Loading events…</div>
        ) : events.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: '0.82rem', color: '#10B981' }}>No active risk events</div>
          </div>
        ) : (
          <div style={{ padding: '8px 16px 16px' }}>
            {events.map((ev, i) => {
              const evLevel = ev.level || 'low'
              const bc = eventBorderColor(evLevel)
              const lvl = getRiskLevel(evLevel === 'critical' ? 85 : evLevel === 'high' ? 65 : evLevel === 'medium' ? 45 : 20)
              return (
                <div key={i} style={{
                  background: '#0D1523',
                  border: '1px solid #1E293B',
                  borderLeft: `3px solid ${bc}`,
                  borderRadius: 8,
                  padding: '14px 18px',
                  marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#E2E8F0' }}>
                        {ev.name || `Event #${i + 1}`}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: lvl.bg,
                        color: lvl.color,
                        textTransform: 'uppercase',
                      }}>
                        {evLevel}
                      </span>
                      {ev.score != null && (
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#475569' }}>
                          score: {Number(ev.score).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>

                  {ev.cause && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Cause: </span>
                      <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{ev.cause}</span>
                    </div>
                  )}

                  {ev.impact && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: '0.68rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Impact: </span>
                      <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{ev.impact}</span>
                    </div>
                  )}

                  {ev.recommended_action && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      background: '#141E2E',
                      borderRadius: 6,
                      border: '1px solid #1E293B',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 6,
                    }}>
                      <span style={{ fontSize: '0.72rem', color: '#06B6D4', marginTop: 1 }}>▶</span>
                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                        {ev.recommended_action}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
