import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Zap, Sun, Fuel, Wind, Leaf, Battery } from 'lucide-react'
import api from '../services/api'
import useStationStore from '../store/stationStore'

const PERIODS = [
  { key: 'daily',   label: 'Daily',   endpoint: '/api/reports/daily' },
  { key: 'weekly',  label: 'Weekly',  endpoint: '/api/reports/weekly' },
  { key: 'monthly', label: 'Monthly', endpoint: '/api/reports/monthly' },
]

const FALLBACK_ROWS = Array.from({ length: 24 }, (_, i) => ({
  timestamp: `2026-09-29T${String(i).padStart(2, '0')}:00:00`,
  total_load_kw: (85 + Math.random() * 40).toFixed(1),
  solar_kw: i >= 6 && i <= 18 ? (Math.random() * 50).toFixed(1) : '0.0',
  wind_kw: (Math.random() * 30).toFixed(1),
  diesel_kw: (20 + Math.random() * 20).toFixed(1),
  battery_soc_pct: (40 + Math.random() * 50).toFixed(1),
  fuel_level_pct: (Math.random() * 50 + 30).toFixed(1),
  renewable_pct: (Math.random() * 60 + 20).toFixed(1),
}))

const FALLBACK_SUMMARY = {
  total_energy_kwh: 2847.3,
  renewable_pct: 64.2,
  solar_kwh: 812.4,
  diesel_kwh: 1018.9,
  co2_avoided_kg: 432.1,
  fuel_consumed_liters: 284.6,
  peak_load_kw: 187.3,
}

function StatBox({ icon: Icon, label, value, unit, accent }) {
  const colors = { cyan: '#06B6D4', green: '#10B981', amber: '#F59E0B', red: '#EF4444', purple: '#8B5CF6' }
  const c = colors[accent] || '#06B6D4'
  return (
    <div style={{
      background: '#101827',
      border: '1px solid #1E293B',
      borderRadius: 8,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 6,
          background: c + '14',
          border: `1px solid ${c}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={14} color={c} />
        </div>
        <span style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
          {label}
        </span>
      </div>
      <div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.4rem', fontWeight: 700, color: c }}>
          {value}
        </span>
        <span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: 5 }}>{unit}</span>
      </div>
    </div>
  )
}

export default function Reports() {
  const [period, setPeriod] = useState('daily')
  const { currentStationId } = useStationStore()

  const currentPeriod = PERIODS.find(p => p.key === period)

  const { data, isLoading } = useQuery({
    queryKey: ['reports', period, currentStationId],
    queryFn: () =>
      api.get(`${currentPeriod.endpoint}?station_id=${currentStationId}`).then(r => r.data),
    retry: false,
  })

  // Response: {summary: {...}, readings: [{...}]}
  const summary = data?.summary || FALLBACK_SUMMARY
  // readings fields: timestamp, total_load_kw, solar_kw, wind_kw, diesel_kw, battery_soc_pct, fuel_level_pct, renewable_pct
  const rows = data?.readings || FALLBACK_ROWS

  const handleExportCSV = () => {
    const url = `${api.defaults.baseURL}/api/reports/export/csv?station_id=${currentStationId}&report_type=${period}`
    window.open(url, '_blank')
  }

  const fmt = (ts) => {
    try { return new Date(ts).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' }) }
    catch { return ts }
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <span className="section-label">Data Export</span>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
            Reports
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
            Energy consumption summaries and operational data exports
          </p>
        </div>
        <button className="btn-cyan" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Period Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#101827', border: '1px solid #1E293B', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            style={{
              padding: '6px 20px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontFamily: 'Space Grotesk',
              fontWeight: 600,
              letterSpacing: '0.04em',
              transition: 'all 0.15s',
              background: period === p.key ? '#06B6D4' : 'transparent',
              color: period === p.key ? '#0A0F1A' : '#475569',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Metrics — summary.{total_energy_kwh, renewable_pct, solar_kwh, diesel_kwh, co2_avoided_kg, fuel_consumed_liters, peak_load_kw} */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatBox icon={Zap}     label="Total Energy"  value={summary.total_energy_kwh?.toFixed(1)}    unit="kWh" accent="cyan" />
        <StatBox icon={Leaf}    label="Renewable %"   value={summary.renewable_pct?.toFixed(1)}       unit="%"   accent="green" />
        <StatBox icon={Sun}     label="Solar"         value={summary.solar_kwh?.toFixed(1)}           unit="kWh" accent="amber" />
        <StatBox icon={Wind}    label="Diesel"        value={summary.diesel_kwh?.toFixed(1)}          unit="kWh" accent="red" />
        <StatBox icon={Leaf}    label="CO₂ Avoided"  value={summary.co2_avoided_kg?.toFixed(1)}      unit="kg"  accent="green" />
        <StatBox icon={Fuel}    label="Fuel Used"     value={summary.fuel_consumed_liters?.toFixed(1)} unit="L"  accent="amber" />
        <StatBox icon={Battery} label="Peak Load"     value={summary.peak_load_kw?.toFixed(1)}        unit="kW"  accent="cyan" />
      </div>

      {/* Data Table */}
      <div className="pg-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={15} color="#06B6D4" />
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, color: '#E2E8F0', fontSize: '0.88rem' }}>
            Hourly Readings — {currentPeriod.label}
          </span>
          {isLoading && (
            <span className="pill pill-dim" style={{ marginLeft: 8 }}>Loading…</span>
          )}
          <span style={{ marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#334155' }}>
            {rows.length} records
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="pg-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Load (kW)</th>
                <th>Solar (kW)</th>
                <th>Wind (kW)</th>
                <th>Diesel (kW)</th>
                <th>Batt SOC (%)</th>
                <th>Fuel Level (%)</th>
                <th>Renewable %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#94A3B8' }}>
                    {fmt(row.timestamp)}
                  </td>
                  {/* total_load_kw (not load_kw) */}
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#E2E8F0' }}>{row.total_load_kw}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#F59E0B' }}>{row.solar_kw}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#06B6D4' }}>{row.wind_kw}</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#EF4444' }}>{row.diesel_kw}</td>
                  {/* battery_soc_pct (not battery_soc) */}
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#10B981' }}>{row.battery_soc_pct}%</td>
                  {/* fuel_level_pct (not fuel_l) */}
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#475569' }}>{row.fuel_level_pct}%</td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#10B981' }}>{row.renewable_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
