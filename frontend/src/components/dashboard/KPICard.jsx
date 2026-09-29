import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

const PALETTE = {
  cyan:   { accent: '#06B6D4', tint: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.15)'  },
  green:  { accent: '#10B981', tint: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.15)' },
  amber:  { accent: '#F59E0B', tint: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.15)' },
  red:    { accent: '#EF4444', tint: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.15)'  },
  purple: { accent: '#8B5CF6', tint: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.15)' },
}

export default function KPICard({
  title,
  value,
  unit,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  color = 'cyan',
  onClick,
}) {
  const p = PALETTE[color] || PALETTE.cyan

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      style={{
        background: '#101827',
        border: `1px solid #1E293B`,
        borderTop: `2px solid ${p.accent}`,
        borderRadius: 8,
        padding: '18px 18px 14px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <p style={{
          fontSize: '0.67rem',
          fontWeight: 700,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          lineHeight: 1,
        }}>
          {title}
        </p>
        {Icon && (
          <div style={{
            width: 30, height: 30, borderRadius: 6,
            background: p.tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} color={p.accent} />
          </div>
        )}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{
          fontFamily: 'Space Grotesk',
          fontSize: '1.75rem',
          fontWeight: 700,
          color: p.accent,
          letterSpacing: '-0.5px',
          lineHeight: 1,
        }}>
          {value ?? '—'}
        </span>
        {unit && (
          <span style={{ fontSize: '0.78rem', color: '#475569', marginBottom: 2 }}>
            {unit}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p style={{ fontSize: '0.7rem', color: '#334155', marginTop: 5 }}>
          {subtitle}
        </p>
      )}

      {/* Trend */}
      {trend !== undefined && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px solid #162032',
          fontSize: '0.7rem',
          color: trend > 0 ? '#10B981' : trend < 0 ? '#EF4444' : '#475569',
        }}>
          {trend > 0 ? <TrendingUp size={11} /> : trend < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
          <span>{Math.abs(trendValue ?? trend).toFixed(1)}% vs yesterday</span>
        </div>
      )}
    </motion.div>
  )
}
