import { motion } from 'framer-motion'

const ACCENT = {
  cyan:   '#06B6D4',
  green:  '#10B981',
  amber:  '#F59E0B',
  red:    '#EF4444',
  purple: '#8B5CF6',
  none:   null,
}

/**
 * pg-card base panel.
 * accent='cyan'|'green'|'amber'|'red'|'purple'|'none'
 */
export default function Card({
  children,
  className = '',
  style = {},
  title,
  subtitle,
  headerAction,
  accent = 'none',
  noPadding = false,
  animate = true,
  ...rest
}) {
  const accentColor = ACCENT[accent]

  const Wrapper = animate ? motion.div : 'div'
  const animProps = animate
    ? { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } }
    : {}

  return (
    <Wrapper
      className={`pg-card ${accentColor ? `pg-card-${accent}` : ''} ${className}`}
      style={style}
      {...animProps}
      {...rest}
    >
      {/* Header */}
      {(title || headerAction) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #162032',
        }}>
          <div>
            {title && (
              <h3 style={{
                fontFamily: 'Space Grotesk',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#E2E8F0',
                letterSpacing: '-0.2px',
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: '0.7rem', color: '#334155', marginTop: 2 }}>
                {subtitle}
              </p>
            )}
          </div>
          {headerAction}
        </div>
      )}

      {/* Body */}
      {noPadding ? children : (
        <div style={{ padding: '18px' }}>{children}</div>
      )}
    </Wrapper>
  )
}
