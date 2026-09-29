import { useState, useRef, useEffect } from 'react'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import useEnergyStore from '../store/energyStore'
import Card from '../components/common/Card'

const SUGGESTED = [
  'What is the current risk level at this station?',
  'How can I reduce diesel consumption today?',
  'Is the battery storage sufficient for tonight?',
  'What happens if the generator fails now?',
  'Recommend optimal load scheduling for next 6 hours',
  'How are renewable sources performing this week?',
]

const DATA_SOURCES = [
  { icon: '⚡', label: 'Live Load Telemetry', color: '#06B6D4' },
  { icon: '☀️', label: 'Solar MPPT Output', color: '#F59E0B' },
  { icon: '💨', label: 'Wind Turbine Data', color: '#10B981' },
  { icon: '🔋', label: 'Battery State of Charge', color: '#8B5CF6' },
  { icon: '🛢️', label: 'Fuel Level Sensors', color: '#EF4444' },
  { icon: '🌡️', label: 'Weather & Temperature', color: '#94A3B8' },
  { icon: '📊', label: 'Historical Patterns', color: '#475569' },
]

function StatPill({ label, value, unit, color }) {
  return (
    <div style={{
      background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6,
      padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1rem', fontWeight: 700, color: color || '#E2E8F0' }}>
        {value}<span style={{ fontSize: '0.62rem', color: '#475569', marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  )
}

function UserMsg({ text }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
      <div style={{
        background: '#141E2E', border: '1px solid #1E293B', borderRadius: '10px 10px 2px 10px',
        padding: '10px 14px', maxWidth: '75%',
        fontSize: '0.8rem', color: '#E2E8F0', fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
      }}>
        {text}
      </div>
    </div>
  )
}

function AIMsg({ msg }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 10, maxWidth: '90%' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', background: '#06B6D420',
          border: '1px solid #06B6D440', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.85rem', flexShrink: 0, marginTop: 2,
        }}>🤖</div>
        <div style={{
          background: '#0D1523', border: '1px solid #1E293B', borderLeft: '3px solid #06B6D4',
          borderRadius: '2px 10px 10px 10px', padding: '12px 14px',
        }}>
          <div style={{ fontSize: '0.8rem', color: '#E2E8F0', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, marginBottom: 10 }}>
            {msg.answer}
          </div>

          {msg.key_metrics && msg.key_metrics.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Key Metrics
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {msg.key_metrics.map((m, i) => (
                  <span key={i} style={{
                    background: '#141E2E', border: '1px solid #1E293B', borderRadius: 4,
                    padding: '3px 8px', fontSize: '0.67rem', color: '#06B6D4',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {m.label}: <strong>{m.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {msg.recommended_action && (
            <div style={{
              background: '#06B6D410', border: '1px solid #06B6D430', borderRadius: 6,
              padding: '8px 12px',
            }}>
              <div style={{ fontSize: '0.6rem', color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                ✦ Recommended Action
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                {msg.recommended_action}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AIAdvisor() {
  const { currentStationId } = useStationStore()
  const energyData = useEnergyStore(s => s.energyData)
  const [messages, setMessages] = useState([
    {
      type: 'ai',
      answer: 'Hello! I\'m your AI Energy Advisor for Polaris stations. I have access to live telemetry, weather data, and historical patterns. Ask me anything about optimizing energy usage, predicting failures, or understanding system performance.',
      key_metrics: [],
      recommended_action: null,
    }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (question) => {
    const q = question || input.trim()
    if (!q || sending) return
    setInput('')
    setSending(true)
    setMessages(m => [...m, { type: 'user', text: q }])

    try {
      const res = await api.post('/api/advisor/query', { station_id: currentStationId, question: q })
      const d = res.data
      setMessages(m => [...m, {
        type: 'ai',
        answer: d.answer || d.response || 'I processed your query. Please check the data above.',
        key_metrics: d.key_metrics || [],
        recommended_action: d.recommended_action || null,
      }])
    } catch (e) {
      setMessages(m => [...m, {
        type: 'ai',
        answer: 'I encountered an error reaching the AI backend. Please ensure the server is running and try again.',
        key_metrics: [],
        recommended_action: null,
      }])
    } finally {
      setSending(false)
    }
  }

  const liveLoad = energyData?.total_load?.toFixed(1) ?? '—'
  const renewPct = energyData?.renewable_percentage?.toFixed(0) ?? '—'
  const batterySoc = energyData?.battery_soc?.toFixed(0) ?? '—'
  const fuelPct = energyData?.fuel_level?.toFixed(0) ?? '—'
  const riskLevel = energyData?.risk_level ?? '—'
  const riskColor = riskLevel === 'HIGH' ? '#EF4444' : riskLevel === 'MEDIUM' ? '#F59E0B' : '#10B981'

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">AI Intelligence</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          AI Energy Advisor
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Real-time AI guidance powered by live station telemetry and predictive models
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* LEFT — Chat */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card title="Energy Advisor Chat" accent="cyan" noPadding>
            {/* Suggested questions */}
            <div style={{ padding: '14px 18px 0' }}>
              <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Quick Questions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {SUGGESTED.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    style={{
                      background: '#0D1523', border: '1px solid #1E293B', borderRadius: 20,
                      padding: '4px 12px', fontSize: '0.68rem', color: '#94A3B8',
                      cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#06B6D4'; e.currentTarget.style.color = '#06B6D4' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E293B'; e.currentTarget.style.color = '#94A3B8' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #1E293B' }} />
            </div>

            {/* Messages */}
            <div style={{ padding: '16px 18px', height: 420, overflowY: 'auto' }}>
              {messages.map((msg, i) =>
                msg.type === 'user'
                  ? <UserMsg key={i} text={msg.text} />
                  : <AIMsg key={i} msg={msg} />
              )}
              {sending && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#06B6D420', border: '1px solid #06B6D440', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>🤖</div>
                  <div style={{ background: '#0D1523', border: '1px solid #1E293B', borderLeft: '3px solid #06B6D4', borderRadius: '2px 10px 10px 10px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#06B6D4', animation: `bounce 0.9s ${d}s infinite` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <style>{`
              @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
            `}</style>

            {/* Input bar */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid #1E293B', display: 'flex', gap: 10 }}>
              <input
                className="pg-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder="Ask about energy optimization, risk assessment, load forecasting…"
                style={{ flex: 1 }}
                disabled={sending}
              />
              <button className="btn-cyan" onClick={() => send()} disabled={sending || !input.trim()} style={{ whiteSpace: 'nowrap' }}>
                {sending ? '…' : 'Send ↑'}
              </button>
            </div>
          </Card>
        </div>

        {/* RIGHT — Station Context */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Station Context" subtitle="Live metrics fed to AI" accent="green">
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <StatPill label="Total Load" value={liveLoad} unit="kW" color="#06B6D4" />
              <StatPill label="Renewable Output" value={renewPct} unit="%" color="#10B981" />
              <StatPill label="Battery SOC" value={batterySoc} unit="%" color="#8B5CF6" />
              <StatPill label="Fuel Level" value={fuelPct} unit="%" color="#F59E0B" />
              <div style={{
                background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6,
                padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Risk Level</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', fontWeight: 700,
                  color: riskColor, background: riskColor + '20', border: `1px solid ${riskColor}40`,
                  borderRadius: 4, padding: '2px 8px',
                }}>
                  {riskLevel}
                </span>
              </div>
            </div>
          </Card>

          <Card title="Data Sources" subtitle="AI knowledge inputs" accent="purple">
            <div style={{ padding: '10px 18px 14px' }}>
              {DATA_SOURCES.map((ds, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < DATA_SOURCES.length - 1 ? '1px solid #1E293B' : 'none' }}>
                  <span style={{ fontSize: '0.85rem' }}>{ds.icon}</span>
                  <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>{ds.label}</span>
                  <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: ds.color }} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
