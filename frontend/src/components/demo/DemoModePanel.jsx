import useDemoStore from '../../store/demoStore'

export default function DemoModePanel() {
  const { isDemoMode, currentScenario, setScenario, scenarios } = useDemoStore()
  if (!isDemoMode) return null

  return (
    <div style={{
      background: 'rgba(245,158,11,0.05)',
      borderBottom: '1px solid rgba(245,158,11,0.15)',
      padding: '8px 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: '0.67rem',
        fontWeight: 700,
        color: '#F59E0B',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>
        ⚠ Simulation Mode
      </span>
      <span style={{ fontSize: '0.72rem', color: 'rgba(245,158,11,0.45)', whiteSpace: 'nowrap' }}>
        Switch scenario:
      </span>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1 }}>
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => setScenario(s.id)}
            style={{
              padding: '3px 12px',
              fontSize: '0.72rem',
              fontWeight: 600,
              borderRadius: 3,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: currentScenario === s.id
                ? '1px solid #F59E0B'
                : '1px solid rgba(255,255,255,0.07)',
              background: currentScenario === s.id
                ? '#F59E0B'
                : 'rgba(255,255,255,0.02)',
              color: currentScenario === s.id
                ? '#0A0F1A'
                : '#94A3B8',
              transition: 'all 0.15s',
            }}
          >
            {s.icon} {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
