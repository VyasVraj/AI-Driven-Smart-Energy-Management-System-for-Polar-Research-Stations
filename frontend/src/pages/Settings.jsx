import { useQuery } from '@tanstack/react-query'
import { Settings2, Bell, Monitor, Save } from 'lucide-react'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import useDemoStore from '../store/demoStore'
import toast from 'react-hot-toast'

function InfoRow({ label, value, unit, accent }) {
  const colors = { cyan: '#06B6D4', green: '#10B981', amber: '#F59E0B', red: '#EF4444' }
  const c = accent ? (colors[accent] || '#06B6D4') : '#06B6D4'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 0',
      borderBottom: '1px solid #1E293B',
    }}>
      <span style={{ fontSize: '0.82rem', color: '#475569' }}>{label}</span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.88rem', fontWeight: 600, color: c }}>
        {value}{unit ? <span style={{ fontSize: '0.72rem', color: '#334155', marginLeft: 4 }}>{unit}</span> : null}
      </span>
    </div>
  )
}

function SectionCard({ title, icon: Icon, accent, children, onSave }) {
  const accents = { cyan: '#06B6D4', amber: '#F59E0B', purple: '#8B5CF6' }
  const c = accents[accent] || '#06B6D4'
  return (
    <div className="pg-card" style={{ borderTop: `2px solid ${c}` }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: c + '14', border: `1px solid ${c}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={c} />
        </div>
        <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: '0.9rem', color: '#E2E8F0' }}>{title}</span>
      </div>
      <div style={{ padding: '4px 20px 0' }}>
        {children}
      </div>
      <div style={{ padding: '16px 20px' }}>
        <button
          className="btn-cyan"
          onClick={onSave}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}
        >
          <Save size={13} />
          Save Settings
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const { currentStationId } = useStationStore()
  const { isDemoMode, currentScenario, scenarios } = useDemoStore()

  const { data } = useQuery({
    queryKey: ['settings', currentStationId],
    queryFn: () => api.get(`/api/stations/${currentStationId}`).then(r => r.data),
    retry: false,
  })

  const station = data || {}
  const scenarioLabel = scenarios?.find(s => s.id === currentScenario)?.name || currentScenario || 'Normal Operation'

  const handleSave = (section) => {
    toast.success(`${section} settings saved`)
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Configuration</span>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          System Settings
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Station configuration, alert thresholds and display preferences
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Section 1: Station Parameters */}
        <SectionCard title="Station Parameters" icon={Settings2} accent="cyan" onSave={() => handleSave('Station Parameters')}>
          <InfoRow label="Solar Capacity"   value={station.solar_capacity_kw   ?? 120}  unit="kW"  accent="amber" />
          <InfoRow label="Wind Capacity"    value={station.wind_capacity_kw    ?? 80}   unit="kW"  accent="cyan" />
          <InfoRow label="Battery Capacity" value={station.battery_capacity_kwh ?? 500} unit="kWh" accent="green" />
          <InfoRow label="Diesel Capacity"  value={station.diesel_capacity_kw  ?? 200}  unit="kW"  accent="red" />
          <InfoRow label="Station ID"       value={`STA-${String(currentStationId).padStart(3,'0')}`} accent="cyan" />
          <InfoRow label="Timezone"         value={station.timezone ?? 'UTC+0'} accent="cyan" />
        </SectionCard>

        {/* Section 2: Alert Thresholds */}
        <SectionCard title="Alert Thresholds" icon={Bell} accent="amber" onSave={() => handleSave('Alert Thresholds')}>
          <InfoRow label="Low Fuel Warning"    value={station.low_fuel_threshold    ?? 20}  unit="%" accent="red" />
          <InfoRow label="Low Battery Warning" value={station.low_battery_threshold ?? 25}  unit="%" accent="amber" />
          <InfoRow label="High Load Warning"   value={station.high_load_threshold   ?? 180} unit="kW" accent="red" />
          <InfoRow label="Temp Alert Min"      value={station.temp_min              ?? -45} unit="°C" accent="cyan" />
          <InfoRow label="Temp Alert Max"      value={station.temp_max              ?? 5}   unit="°C" accent="amber" />
          <InfoRow label="Wind Speed Alert"    value={station.wind_alert_ms         ?? 25}  unit="m/s" accent="red" />
        </SectionCard>

        {/* Section 3: Display Preferences */}
        <SectionCard title="Display Preferences" icon={Monitor} accent="purple" onSave={() => handleSave('Display Preferences')}>
          <InfoRow label="Current Scenario"  value={scenarioLabel}                  accent="cyan" />
          <InfoRow label="Demo Mode"         value={isDemoMode ? 'Enabled' : 'Disabled'} accent={isDemoMode ? 'green' : 'red'} />
          <InfoRow label="Refresh Interval"  value={15}  unit="s"   accent="cyan" />
          <InfoRow label="Chart History"     value={24}  unit="hrs" accent="cyan" />
          <InfoRow label="Data Precision"    value={1}   unit="dp"  accent="cyan" />
          <InfoRow label="Timezone Display"  value="UTC" accent="cyan" />
        </SectionCard>

      </div>
    </div>
  )
}
