import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import Card from '../components/common/Card'

const PRESETS = [
  {
    key: 'normal', label: 'Normal', emoji: '☀️',
    params: { solar: 120, wind: 180, battery: 500, loadMult: 1.0, temp: -15, fuel: 75, genAvail: true, extremeWeather: false }
  },
  {
    key: 'high_demand', label: 'High Demand', emoji: '⚡',
    params: { solar: 120, wind: 180, battery: 500, loadMult: 1.8, temp: -10, fuel: 75, genAvail: true, extremeWeather: false }
  },
  {
    key: 'storm', label: 'Storm', emoji: '🌪️',
    params: { solar: 20, wind: 300, battery: 400, loadMult: 1.3, temp: -35, fuel: 60, genAvail: true, extremeWeather: true }
  },
  {
    key: 'polar_night', label: 'Polar Night', emoji: '🌑',
    params: { solar: 0, wind: 150, battery: 600, loadMult: 1.1, temp: -45, fuel: 50, genAvail: true, extremeWeather: false }
  },
  {
    key: 'generator_failure', label: 'Gen Failure', emoji: '🔧',
    params: { solar: 120, wind: 180, battery: 800, loadMult: 1.0, temp: -20, fuel: 70, genAvail: false, extremeWeather: false }
  },
  {
    key: 'low_fuel', label: 'Low Fuel', emoji: '⛽',
    params: { solar: 100, wind: 160, battery: 500, loadMult: 1.0, temp: -18, fuel: 15, genAvail: true, extremeWeather: false }
  },
]

const TT = {
  contentStyle: { background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#94A3B8' },
  itemStyle: { color: '#E2E8F0' },
  cursor: { stroke: '#1E293B' },
}

function Slider({ label, min, max, step = 1, value, unit, onChange }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>{label}</span>
        <span style={{ fontSize: '0.72rem', color: '#06B6D4', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#06B6D4', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: '0.6rem', color: '#334155' }}>{min}{unit}</span>
        <span style={{ fontSize: '0.6rem', color: '#334155' }}>{max}{unit}</span>
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'Inter, sans-serif' }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
          background: value ? '#06B6D4' : '#1E293B',
          position: 'relative', transition: 'background 0.2s',
          border: '1px solid ' + (value ? '#06B6D4' : '#334155'),
        }}
      >
        <div style={{
          position: 'absolute', top: 2, left: value ? 20 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: value ? '#fff' : '#475569',
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )
}

function MetricBox({ label, value, unit, change, accent }) {
  const color = accent || '#E2E8F0'
  const changeColor = change > 0 ? '#EF4444' : change < 0 ? '#10B981' : '#94A3B8'
  return (
    <div style={{
      background: '#0D1523', border: '1px solid #1E293B', borderRadius: 6,
      padding: '10px 14px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color }}>
        {value}<span style={{ fontSize: '0.65rem', color: '#475569', marginLeft: 3 }}>{unit}</span>
      </div>
      {change !== undefined && (
        <div style={{ fontSize: '0.62rem', color: changeColor, marginTop: 3 }}>
          {change > 0 ? '▲' : change < 0 ? '▼' : '—'} {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

export default function WhatIfSimulator() {
  const { currentStationId } = useStationStore()
  const [activePreset, setActivePreset] = useState('normal')
  const [params, setParams] = useState(PRESETS[0].params)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const applyPreset = (preset) => {
    setActivePreset(preset.key)
    setParams(preset.params)
    setResult(null)
  }

  const setParam = (key, val) => setParams(p => ({ ...p, [key]: val }))

  const runSim = async () => {
    setLoading(true)
    setError(null)
    try {
      // API expects parameters wrapped in a 'parameters' object
      const body = {
        station_id: currentStationId,
        scenario_name: activePreset,
        parameters: {
          solar_capacity_kw:    params.solar,
          wind_capacity_kw:     params.wind,
          battery_capacity_kwh: params.battery,
          load_multiplier:      params.loadMult,
          temperature_c:        params.temp,
          fuel_level_pct:       params.fuel,
          generator_available:  params.genAvail,
          extreme_weather:      params.extremeWeather,
          high_demand:          params.loadMult > 1.4,
        },
      }
      const res = await api.post('/api/simulation/run', body)
      setResult(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Simulation failed. Check connection.')
    } finally {
      setLoading(false)
    }
  }

  // Correct response keys from API
  const before  = result?.comparison?.baseline  || null
  const after   = result?.comparison?.simulated || null
  const impact  = result?.impact                || {}
  const hourly  = result?.hourly_comparison     || []
  const changes = result?.changes_explained     || []

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">Simulation Engine</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          What-If Simulator
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          Model energy scenarios and evaluate system resilience before real-world implementation
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* LEFT — Parameters */}
        <div style={{ width: '40%', flexShrink: 0 }}>
          <Card title="Simulation Parameters" accent="cyan">
            <div style={{ padding: '14px 18px' }}>
              {/* Preset grid */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  Preset Scenarios
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {PRESETS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p)}
                      style={{
                        background: activePreset === p.key ? '#06B6D420' : '#0D1523',
                        border: `1px solid ${activePreset === p.key ? '#06B6D4' : '#1E293B'}`,
                        borderRadius: 6, padding: '8px 4px', cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        color: activePreset === p.key ? '#06B6D4' : '#94A3B8',
                        fontSize: '0.68rem', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '1.1rem' }}>{p.emoji}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #1E293B', marginBottom: 16 }} />

              {/* Sliders */}
              <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Parameter Overrides
              </div>
              <Slider label="Solar Capacity" min={0} max={300} value={params.solar} unit="kW" onChange={v => setParam('solar', v)} />
              <Slider label="Wind Capacity" min={0} max={400} value={params.wind} unit="kW" onChange={v => setParam('wind', v)} />
              <Slider label="Battery Capacity" min={0} max={1000} value={params.battery} unit="kWh" onChange={v => setParam('battery', v)} />
              <Slider label="Load Multiplier" min={0.5} max={2.0} step={0.05} value={params.loadMult} unit="×" onChange={v => setParam('loadMult', v)} />
              <Slider label="Temperature" min={-50} max={10} value={params.temp} unit="°C" onChange={v => setParam('temp', v)} />
              <Slider label="Fuel Level" min={0} max={100} value={params.fuel} unit="%" onChange={v => setParam('fuel', v)} />

              <div style={{ borderTop: '1px solid #1E293B', margin: '14px 0' }} />

              {/* Toggles */}
              <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                System Flags
              </div>
              <Toggle label="Generator Available" value={params.genAvail} onChange={v => setParam('genAvail', v)} />
              <Toggle label="Extreme Weather Mode" value={params.extremeWeather} onChange={v => setParam('extremeWeather', v)} />

              <button
                className="btn-cyan"
                onClick={runSim}
                disabled={loading}
                style={{ width: '100%', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 14, height: 14, border: '2px solid #06B6D480', borderTopColor: '#06B6D4',
                      borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite'
                    }} />
                    Running…
                  </>
                ) : '▶  RUN SIMULATION'}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

              {error && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#EF444420', border: '1px solid #EF4444', borderRadius: 6, fontSize: '0.72rem', color: '#EF4444' }}>
                  {error}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT — Results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!result ? (
            <div style={{
              background: '#101827', border: '1px solid #1E293B', borderRadius: 8,
              padding: '60px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔬</div>
              <div style={{ color: '#475569', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
                Configure parameters and click <strong style={{ color: '#06B6D4' }}>RUN SIMULATION</strong> to see results
              </div>
            </div>
          ) : (
            <>
              {/* Before / After */}
              <Card title="State Comparison" accent="cyan">
                <div style={{ padding: '14px 18px' }}>
                  {/* Impact summary row */}
                  {impact && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                      {[
                        { label: 'Fuel Saved',       value: `${impact.fuel_saved_liters?.toFixed(0) ?? '—'} L`, color: '#10B981' },
                        { label: 'CO₂ Saved',        value: `${impact.co2_saved_kg?.toFixed(0) ?? '—'} kg`,    color: '#10B981' },
                        { label: 'Renewable Δ',      value: `${impact.renewable_change_pct > 0 ? '+' : ''}${impact.renewable_change_pct?.toFixed(1) ?? '—'}%`, color: impact.renewable_change_pct >= 0 ? '#10B981' : '#EF4444' },
                      ].map(item => (
                        <div key={item.label} style={{ background: '#0D1523', border: '1px solid #1E293B', borderRadius: 6, padding: '10px 12px' }}>
                          <div style={{ fontSize: '0.62rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.1rem', fontWeight: 700, color: item.color }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Before — comparison.baseline */}
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        ⬛ Baseline
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <MetricBox label="Fuel / Day"    value={before?.fuel_consumption_liters_day?.toFixed(0) ?? '—'} unit="L" />
                        <MetricBox label="Renewable"     value={before?.renewable_pct?.toFixed(1) ?? '—'}               unit="%" />
                        <MetricBox label="Avg Diesel"    value={before?.avg_diesel_kw?.toFixed(0) ?? '—'}               unit="kW" />
                        <MetricBox label="Reliability"   value={before?.reliability_pct?.toFixed(1) ?? '—'}             unit="%" />
                        <MetricBox label="Backup"        value={before?.backup_hours?.toFixed(1) ?? '—'}                unit="h" />
                      </div>
                    </div>
                    {/* After — comparison.simulated */}
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                        🔵 Simulated
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <MetricBox label="Fuel / Day"  value={after?.fuel_consumption_liters_day?.toFixed(0) ?? '—'} unit="L" accent="#06B6D4"
                          change={before?.fuel_consumption_liters_day ? ((after?.fuel_consumption_liters_day - before?.fuel_consumption_liters_day) / before?.fuel_consumption_liters_day) * 100 : undefined} />
                        <MetricBox label="Renewable"   value={after?.renewable_pct?.toFixed(1) ?? '—'}               unit="%" accent="#10B981"
                          change={before?.renewable_pct ? after?.renewable_pct - before?.renewable_pct : undefined} />
                        <MetricBox label="Avg Diesel"  value={after?.avg_diesel_kw?.toFixed(0) ?? '—'}               unit="kW" accent="#F59E0B"
                          change={before?.avg_diesel_kw ? ((after?.avg_diesel_kw - before?.avg_diesel_kw) / before?.avg_diesel_kw) * 100 : undefined} />
                        <MetricBox label="Reliability" value={after?.reliability_pct?.toFixed(1) ?? '—'}             unit="%" accent="#8B5CF6"
                          change={before?.reliability_pct ? after?.reliability_pct - before?.reliability_pct : undefined} />
                        <MetricBox label="Backup"      value={after?.backup_hours?.toFixed(1) ?? '—'}                unit="h" accent="#06B6D4"
                          change={before?.backup_hours ? after?.backup_hours - before?.backup_hours : undefined} />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Hourly Chart — correct field names */}
              {hourly.length > 0 && (
                <Card title="24-Hour Energy Mix" subtitle="Baseline vs. simulated hourly dispatch" accent="cyan">
                  <div style={{ padding: '0 18px 18px' }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={hourly} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#162032" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fill: '#334155', fontSize: 9 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#334155', fontSize: 9 }} tickLine={false} axisLine={false} />
                        <Tooltip {...TT} />
                        <Legend wrapperStyle={{ fontSize: 10, color: '#475569' }} />
                        <Bar dataKey="baseline_diesel_kw"    stackId="b" fill="#47556950" name="Baseline Diesel" radius={0} />
                        <Bar dataKey="simulated_diesel_kw"   stackId="s" fill="#EF4444"   name="Sim Diesel"      radius={0} />
                        <Bar dataKey="simulated_renewable_kw" stackId="s" fill="#10B981"  name="Sim Renewable"   radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}

              {/* Changes Explained */}
              {changes.length > 0 && (
                <Card title="Changes Explained" accent="amber">
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {changes.map((item, i) => {
                      const dotColor = item.type === 'positive' ? '#10B981' : item.type === 'negative' ? '#EF4444' : '#F59E0B'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, marginTop: 5, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                            {item.text || item}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
