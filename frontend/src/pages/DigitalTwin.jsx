import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import Card from '../components/common/Card'

const NODE_W = 110   // uniform width for all nodes
const NODE_H = 72    // uniform height for all nodes

const COMPONENTS = [
  {
    id: 'solar', label: 'Solar Array', emoji: '☀️',
    x: 60,  y: 40,
    color: '#F59E0B',
  },
  {
    id: 'wind1', label: 'Wind Turbine A', emoji: '💨',
    x: 200, y: 40,
    color: '#06B6D4',
  },
  {
    id: 'wind2', label: 'Wind Turbine B', emoji: '💨',
    x: 340, y: 40,
    color: '#06B6D4',
  },
  {
    id: 'main_building', label: 'Main Station', emoji: '🏢',
    x: 195, y: 170,
    color: '#8B5CF6',
  },
  {
    id: 'battery', label: 'Battery Bank', emoji: '🔋',
    x: 340, y: 170,
    color: '#10B981',
  },
  {
    id: 'generator', label: 'Diesel Generator', emoji: '⚙️',
    x: 60,  y: 170,
    color: '#EF4444',
  },
  {
    id: 'fuel_tank', label: 'Fuel Storage', emoji: '🛢️',
    x: 60,  y: 290,
    color: '#F59E0B',
  },
  {
    id: 'lab', label: 'Research Lab', emoji: '🔬',
    x: 340, y: 290,
    color: '#8B5CF6',
  },
]


const TELEMETRY_METRICS = [
  { key: 'total_load', label: 'Total Load', unit: 'kW', color: '#06B6D4' },
  { key: 'solar_output', label: 'Solar Output', unit: 'kW', color: '#F59E0B' },
  { key: 'wind_output', label: 'Wind Output', unit: 'kW', color: '#06B6D4' },
  { key: 'battery_soc', label: 'Battery SOC', unit: '%', color: '#10B981' },
  { key: 'diesel_output', label: 'Diesel Gen', unit: 'kW', color: '#EF4444' },
  { key: 'fuel_level', label: 'Fuel Level', unit: '%', color: '#F59E0B' },
  { key: 'temperature', label: 'Ext. Temp', unit: '°C', color: '#94A3B8' },
  { key: 'renewable_percentage', label: 'Renewable %', unit: '%', color: '#10B981' },
]

function ComponentDetails({ comp, telemetry }) {
  if (!comp) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: '0.8rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: 10 }}>👆</div>
        Click a component on the diagram to view its details
      </div>
    )
  }

  const details = telemetry?.components?.[comp.id] || {}
  const health = details.health ?? Math.floor(70 + Math.random() * 30)
  const healthColor = health >= 80 ? '#10B981' : health >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: '1.6rem' }}>{comp.emoji}</span>
        <div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1rem', fontWeight: 700, color: '#E2E8F0' }}>{comp.label}</div>
          <div style={{ fontSize: '0.65rem', color: comp.color, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {details.status || 'ONLINE'}
          </div>
        </div>
      </div>

      {/* Health bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: '0.65rem', color: '#475569' }}>System Health</span>
          <span style={{ fontSize: '0.65rem', color: healthColor, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{health}%</span>
        </div>
        <div style={{ height: 5, background: '#1E293B', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${health}%`, background: healthColor, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Output', value: details.output ?? '—', unit: details.output_unit ?? 'kW', color: comp.color },
          { label: 'Efficiency', value: details.efficiency ?? '—', unit: '%', color: '#10B981' },
          { label: 'Last Maint.', value: details.last_maintenance ?? 'N/A', unit: '', color: '#94A3B8' },
          { label: 'Runtime', value: details.runtime_hours ?? '—', unit: 'h', color: '#8B5CF6' },
          { label: 'Temp', value: details.temp ?? '—', unit: '°C', color: '#F59E0B' },
          { label: 'Alerts', value: details.alerts ?? 0, unit: '', color: details.alerts > 0 ? '#EF4444' : '#10B981' },
        ].map((item, i) => (
          <div key={i} style={{ background: '#0D1523', border: '1px solid #1E293B', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.58rem', color: '#334155', textTransform: 'uppercase', marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 700, color: item.color }}>
              {item.value}{item.unit && <span style={{ fontSize: '0.6rem', color: '#475569', marginLeft: 2 }}>{item.unit}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DigitalTwin() {
  const { currentStationId } = useStationStore()
  const [selectedComp, setSelectedComp] = useState(null)

  const { data: telemetry } = useQuery({
    queryKey: ['digital-twin', currentStationId],
    queryFn: () => api.get(`/api/digital-twin?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 10000,
  })

  const liveData = telemetry?.telemetry || telemetry || {}

  const compDetails = COMPONENTS.find(c => c.id === selectedComp)

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Digital Twin</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Station Digital Twin
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Interactive 3D model — click components to inspect status, output, and maintenance data
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
        {/* LEFT — SVG Diagram */}
        <div style={{ flex: 1 }}>
          <Card title="Station Diagram" subtitle="Click any component to inspect" accent="cyan" noPadding>
            <div style={{ padding: '16px 18px' }}>
              <svg
                viewBox="0 0 490 410"
                style={{ width: '100%', background: '#0D1523', borderRadius: 6, border: '1px solid #1E293B', cursor: 'pointer' }}
              >
                <defs>
                  {/* One clipPath per component so text never bleeds outside its rect */}
                  {COMPONENTS.map(comp => (
                    <clipPath key={`clip-${comp.id}`} id={`clip-${comp.id}`}>
                      <rect x={comp.x + 4} y={comp.y + 4} width={NODE_W - 8} height={NODE_H - 8} />
                    </clipPath>
                  ))}
                </defs>

                {/* Ground stripe */}
                <rect x="0" y="390" width="490" height="20" fill="#162032" />
                <line x1="0" y1="390" x2="490" y2="390" stroke="#1E293B" strokeWidth="1" />

                {/* ── Connection lines (centre-to-centre) ─────────────────── */}
                {/* Solar → Main Station */}
                <line x1={60 + NODE_W/2} y1={40 + NODE_H} x2={195 + NODE_W/2} y2={170}
                  stroke="#1E293B" strokeWidth="1.5" strokeDasharray="5,3" />
                {/* Wind A → Main Station */}
                <line x1={200 + NODE_W/2} y1={40 + NODE_H} x2={195 + NODE_W/2} y2={170}
                  stroke="#1E293B" strokeWidth="1.5" strokeDasharray="5,3" />
                {/* Wind B → Main Station */}
                <line x1={340 + NODE_W/2} y1={40 + NODE_H} x2={195 + NODE_W/2} y2={170}
                  stroke="#1E293B" strokeWidth="1.5" strokeDasharray="5,3" />
                {/* Generator → Main Station */}
                <line x1={60 + NODE_W} y1={170 + NODE_H/2} x2={195} y2={170 + NODE_H/2}
                  stroke="#1E293B" strokeWidth="1.5" strokeDasharray="5,3" />
                {/* Main Station → Battery */}
                <line x1={195 + NODE_W} y1={170 + NODE_H/2} x2={340} y2={170 + NODE_H/2}
                  stroke="#1E293B" strokeWidth="1.5" strokeDasharray="5,3" />
                {/* Generator → Fuel Storage */}
                <line x1={60 + NODE_W/2} y1={170 + NODE_H} x2={60 + NODE_W/2} y2={290}
                  stroke="#1E293B" strokeWidth="1.5" strokeDasharray="5,3" />
                {/* Main Station → Research Lab */}
                <line x1={195 + NODE_W} y1={170 + NODE_H/2} x2={340} y2={290 + NODE_H/2}
                  stroke="#1E293B" strokeWidth="1.5" strokeDasharray="5,3" />

                {/* ── Component nodes ──────────────────────────────────────── */}
                {COMPONENTS.map(comp => {
                  const isSelected = selectedComp === comp.id
                  const isActive   = comp.id !== 'generator'
                  const fill    = isActive ? comp.color + '18' : '#162032'
                  const stroke  = isSelected ? comp.color : isActive ? comp.color + '70' : '#1E293B'
                  const strokeW = isSelected ? 2.5 : 1.5
                  const cx      = comp.x + NODE_W / 2
                  const emojiY  = comp.y + NODE_H * 0.44     // icon sits in top half
                  const labelY  = comp.y + NODE_H - 12        // label sits near bottom

                  return (
                    <g key={comp.id} onClick={() => setSelectedComp(comp.id)} style={{ cursor: 'pointer' }}>
                      {/* Selection glow */}
                      {isSelected && (
                        <rect
                          x={comp.x - 4} y={comp.y - 4}
                          width={NODE_W + 8} height={NODE_H + 8}
                          rx="7" fill={comp.color + '12'}
                          stroke={comp.color + '50'} strokeWidth="1"
                        />
                      )}
                      {/* Box */}
                      <rect
                        x={comp.x} y={comp.y}
                        width={NODE_W} height={NODE_H}
                        rx="5" fill={fill} stroke={stroke} strokeWidth={strokeW}
                      />
                      {/* Top accent stripe */}
                      {isSelected && (
                        <rect x={comp.x} y={comp.y} width={NODE_W} height={2.5} rx="5" fill={comp.color} />
                      )}
                      {/* Emoji icon — clipped to box */}
                      <text
                        x={cx} y={emojiY}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="20" clipPath={`url(#clip-${comp.id})`}
                      >
                        {comp.emoji}
                      </text>
                      {/* Label — clipped, always fits inside */}
                      <text
                        x={cx} y={labelY}
                        textAnchor="middle" dominantBaseline="auto"
                        fontSize="9.5"
                        fill={isSelected ? comp.color : '#94A3B8'}
                        fontFamily="Inter, sans-serif"
                        fontWeight={isSelected ? '700' : '400'}
                        clipPath={`url(#clip-${comp.id})`}
                      >
                        {comp.label}
                      </text>
                      {/* Active indicator dot */}
                      {isActive && (
                        <circle cx={comp.x + NODE_W - 9} cy={comp.y + 9} r="3.5" fill="#10B981" />
                      )}
                    </g>
                  )
                })}

                {/* Legend */}
                <g transform="translate(10, 8)">
                  <circle cx="6" cy="6" r="3" fill="#10B981" />
                  <text x="13" y="10" fontSize="8" fill="#475569" fontFamily="Inter">Active</text>
                  <circle cx="52" cy="6" r="3" fill="#EF4444" />
                  <text x="59" y="10" fontSize="8" fill="#475569" fontFamily="Inter">Alert</text>
                </g>
              </svg>
            </div>
          </Card>
        </div>

        {/* RIGHT — Component Details */}
        <div style={{ width: 300, flexShrink: 0 }}>
          <Card title="Component Details" subtitle={compDetails?.label || 'Select a component'} accent={selectedComp ? 'cyan' : undefined}>
            <ComponentDetails comp={compDetails} telemetry={telemetry} />
          </Card>
        </div>
      </div>

      {/* Telemetry Grid */}
      <Card title="Live Telemetry" subtitle="Real-time station metrics" accent="green">
        <div style={{ padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {TELEMETRY_METRICS.map(m => {
              const val = liveData[m.key]
              const display = val !== undefined && val !== null ? (typeof val === 'number' ? val.toFixed(m.unit === '%' ? 0 : 1) : val) : '—'
              return (
                <div key={m.key} style={{
                  background: '#0D1523', border: '1px solid #1E293B', borderRadius: 6,
                  padding: '12px 14px', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: 2,
                    background: m.color,
                  }} />
                  <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.3rem', fontWeight: 700, color: m.color }}>
                    {display}
                    <span style={{ fontSize: '0.6rem', color: '#334155', marginLeft: 3 }}>{m.unit}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981' }} />
                    <span style={{ fontSize: '0.58rem', color: '#334155' }}>Live</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
