import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import Card from '../components/common/Card'

function SourceBar({ label, pct, kw, color, icon }) {
  const safeP = Math.min(100, Math.max(0, pct || 0))
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{icon}</span>
          <span style={{ fontSize: '0.78rem', color: '#E2E8F0', fontFamily: 'Inter, sans-serif' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94A3B8' }}>
            {kw !== undefined && kw !== null ? `${Number(kw).toFixed(0)} kW` : '—'}
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', fontWeight: 700, color,
            minWidth: 40, textAlign: 'right',
          }}>
            {safeP.toFixed(0)}%
          </span>
        </div>
      </div>
      <div style={{ height: 10, background: '#1E293B', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${safeP}%`, background: color,
          borderRadius: 5, transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

function SavingsCard({ label, value, unit, icon, color }) {
  return (
    <div style={{
      background: '#0D1523', border: '1px solid #1E293B', borderLeft: `3px solid ${color}`,
      borderRadius: 8, padding: '16px 20px', flex: 1,
    }}>
      <div style={{ fontSize: '1.4rem', marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.6rem', fontWeight: 700, color, marginBottom: 4 }}>
        {value}
        <span style={{ fontSize: '0.65rem', color: '#475569', marginLeft: 4 }}>{unit}</span>
      </div>
      <div style={{ fontSize: '0.68rem', color: '#475569', fontFamily: 'Inter, sans-serif' }}>{label}</div>
    </div>
  )
}

export default function EnergyOptimization() {
  const { currentStationId } = useStationStore()

  const { data: optData, isLoading, error, refetch } = useQuery({
    queryKey: ['optimization', currentStationId],
    queryFn: () => api.get(`/api/optimization/recommendation?station_id=${currentStationId}`).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: historyData } = useQuery({
    queryKey: ['optimization-history', currentStationId],
    queryFn: () => api.get(`/api/optimization/history?station_id=${currentStationId}&limit=5`).then(r => r.data),
    refetchInterval: 60000,
  })

  // Current recommendation fields: solar_pct, wind_pct, battery_pct, diesel_pct,
  // solar_kw, wind_kw, battery_kw, diesel_kw, explanation: [string],
  // expected_savings: {diesel_liters, co2_kg}, renewable_contribution_pct
  const rec = optData ?? {}

  const solarPct  = rec.solar_pct   ?? 0
  const windPct   = rec.wind_pct    ?? 0
  const batteryPct = rec.battery_pct ?? 0
  const dieselPct = rec.diesel_pct  ?? 0

  const solarKw   = rec.solar_kw    ?? null
  const windKw    = rec.wind_kw     ?? null
  const batteryKw = rec.battery_kw  ?? null
  const dieselKw  = rec.diesel_kw   ?? null

  // explanation is [string]
  const explanations = Array.isArray(rec.explanation) ? rec.explanation : []

  // expected_savings: {diesel_liters, co2_kg}
  const expectedSavings = rec.expected_savings ?? {}
  const dieselSaved = expectedSavings.diesel_liters ?? 0
  const co2Saved    = expectedSavings.co2_kg ?? 0

  // History items: {timestamp, recommended_mix: {solar_pct, wind_pct, battery_pct, diesel_pct}, diesel_saved_liters, co2_saved_kg}
  const history = Array.isArray(historyData) ? historyData : (historyData?.history ?? historyData ?? [])

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span className="section-label">Optimization Engine</span>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
            Energy Optimization
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
            AI-computed optimal dispatch strategy minimizing fuel consumption and emissions
          </p>
        </div>
        <button className="btn-outline" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? '⟳ Updating…' : '⟳ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#EF444420', border: '1px solid #EF444440', borderRadius: 8, padding: '10px 16px', marginBottom: 16, color: '#EF4444', fontSize: '0.78rem' }}>
          ⚠ Could not load optimization data from API. Displaying demo values.
        </div>
      )}

      {/* Dispatch Recommendation Card */}
      <Card title="Optimal Dispatch Recommendation" subtitle="AI-computed energy source allocation" accent="cyan" noPadding>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Source bars */}
            <div>
              <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Energy Source Allocation
              </div>
              <SourceBar label="Solar PV"         pct={solarPct}   kw={solarKw}   color="#F59E0B" icon="☀️" />
              <SourceBar label="Wind Turbine"      pct={windPct}    kw={windKw}    color="#06B6D4" icon="💨" />
              <SourceBar label="Battery Storage"   pct={batteryPct} kw={batteryKw} color="#8B5CF6" icon="🔋" />
              <SourceBar label="Diesel Generator"  pct={dieselPct}  kw={dieselKw}  color="#EF4444" icon="⚙️" />

              {/* Renewable contribution */}
              {rec.renewable_contribution_pct != null && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: '#10B98110', border: '1px solid #10B98130', borderRadius: 6 }}>
                  <div style={{ fontSize: '0.62rem', color: '#475569', marginBottom: 4 }}>Renewable Contribution</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color: '#10B981' }}>
                    {Number(rec.renewable_contribution_pct).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>

            {/* Explanation */}
            <div>
              <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Optimization Rationale
              </div>
              {explanations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {explanations.map((text, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#06B6D4', marginTop: 6, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#334155', fontSize: '0.78rem', fontStyle: 'italic' }}>
                  No explanation data available. Run the optimization engine to generate recommendations.
                </div>
              )}

              {/* Visual split ring */}
              <div style={{ marginTop: 20, display: 'flex', gap: 4, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                {[
                  { pct: solarPct,   color: '#F59E0B' },
                  { pct: windPct,    color: '#06B6D4' },
                  { pct: batteryPct, color: '#8B5CF6' },
                  { pct: dieselPct,  color: '#EF4444' },
                ].filter(s => s.pct > 0).map((s, i) => (
                  <div key={i} style={{ flex: s.pct, background: s.color, borderRadius: 0 }} />
                ))}
                {(solarPct + windPct + batteryPct + dieselPct) === 0 && (
                  <div style={{ flex: 1, background: '#1E293B' }} />
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {[
                  { label: 'Solar',   color: '#F59E0B' },
                  { label: 'Wind',    color: '#06B6D4' },
                  { label: 'Battery', color: '#8B5CF6' },
                  { label: 'Diesel',  color: '#EF4444' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                    <span style={{ fontSize: '0.62rem', color: '#475569' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Savings Summary */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Projected Savings (expected_savings)
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <SavingsCard
            label="Diesel Saved (expected)"
            value={Number(dieselSaved).toFixed(1)}
            unit="L"
            icon="⛽"
            color="#10B981"
          />
          <SavingsCard
            label="CO₂ Avoided (expected)"
            value={Number(co2Saved).toFixed(2)}
            unit="kg"
            icon="🌿"
            color="#10B981"
          />
        </div>
      </div>

      {/* History table */}
      <div style={{ marginTop: 20 }}>
        <Card title="Recommendation History" subtitle="Last 5 optimization cycles" accent="amber" noPadding>
          <div style={{ padding: '0 0 4px' }}>
            <table className="pg-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Solar %</th>
                  <th>Wind %</th>
                  <th>Battery %</th>
                  <th>Diesel %</th>
                  <th>Diesel Saved</th>
                  <th>CO₂ Saved</th>
                </tr>
              </thead>
              <tbody>
                {history.length > 0 ? history.map((row, i) => {
                  // recommended_mix: {solar_pct, wind_pct, battery_pct, diesel_pct}
                  const mix = row.recommended_mix ?? {}
                  return (
                    <tr key={i}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#475569' }}>
                        {row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}
                      </td>
                      <td><span style={{ color: '#F59E0B', fontFamily: 'JetBrains Mono, monospace' }}>{(mix.solar_pct ?? 0).toFixed(0)}%</span></td>
                      <td><span style={{ color: '#06B6D4', fontFamily: 'JetBrains Mono, monospace' }}>{(mix.wind_pct ?? 0).toFixed(0)}%</span></td>
                      <td><span style={{ color: '#8B5CF6', fontFamily: 'JetBrains Mono, monospace' }}>{(mix.battery_pct ?? 0).toFixed(0)}%</span></td>
                      <td><span style={{ color: '#EF4444', fontFamily: 'JetBrains Mono, monospace' }}>{(mix.diesel_pct ?? 0).toFixed(0)}%</span></td>
                      <td><span style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>{(row.diesel_saved_liters ?? 0).toFixed(1)} L</span></td>
                      <td><span style={{ color: '#10B981', fontFamily: 'JetBrains Mono, monospace' }}>{(row.co2_saved_kg ?? 0).toFixed(2)} kg</span></td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#334155', padding: '20px 0', fontSize: '0.78rem' }}>
                      No history available yet — recommendations will appear after the engine runs.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
