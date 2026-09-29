export default function GaugeChart({ value = 0, size = 160, label, unit = '%' }) {
  const clamped = Math.min(100, Math.max(0, value))
  const R = size * 0.38
  const cx = size / 2
  const cy = size / 2

  // Semi-circle gauge: arc from 210° to 330° (240° sweep)
  const startAngle = 215
  const sweepAngle = 290
  const endAngle   = startAngle + (sweepAngle * clamped) / 100

  const toRad = deg => (deg * Math.PI) / 180
  const arcX  = (angle, r) => cx + r * Math.cos(toRad(angle))
  const arcY  = (angle, r) => cy + r * Math.sin(toRad(angle))

  const trackPath = describeArc(cx, cy, R, startAngle, startAngle + sweepAngle, size)
  const fillPath  = clamped > 0 ? describeArc(cx, cy, R, startAngle, endAngle, size) : ''

  // Color based on value
  const color =
    clamped < 20 ? '#EF4444' :
    clamped < 40 ? '#F59E0B' :
    clamped > 80 ? '#10B981' :
                   '#06B6D4'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <path d={trackPath} fill="none" stroke="#1E293B" strokeWidth={size * 0.08} strokeLinecap="round" />
          {/* Fill */}
          {clamped > 0 && (
            <path
              d={fillPath}
              fill="none"
              stroke={color}
              strokeWidth={size * 0.08}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          )}
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map(pct => {
            const angle = startAngle + (sweepAngle * pct) / 100
            const ix1 = arcX(angle, R - size * 0.04)
            const iy1 = arcY(angle, R - size * 0.04)
            const ix2 = arcX(angle, R + size * 0.05)
            const iy2 = arcY(angle, R + size * 0.05)
            return (
              <line key={pct} x1={ix1} y1={iy1} x2={ix2} y2={iy2}
                stroke="#273548" strokeWidth={1.5} strokeLinecap="round" />
            )
          })}
        </svg>

        {/* Center text */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: size * 0.1,
        }}>
          <span style={{
            fontFamily: 'Space Grotesk',
            fontSize: size * 0.18,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}>
            {Math.round(clamped)}
          </span>
          <span style={{
            fontSize: size * 0.1,
            color: '#475569',
            marginTop: 2,
          }}>
            {unit}
          </span>
        </div>
      </div>

      {label && (
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}>
          {label}
        </span>
      )}
    </div>
  )
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const toRad = d => (d * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle))
  const y2 = cy + r * Math.sin(toRad(endAngle))
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
}
