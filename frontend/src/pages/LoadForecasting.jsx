import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '../services/api'
import useStationStore from '../store/stationStore'
import Card from '../components/common/Card'

const TT = {
  contentStyle: { background: '#141E2E', border: '1px solid #1E293B', borderRadius: 6, fontSize: 12 },
  labelStyle: { color: '#94A3B8' },
  itemStyle: { color: '#E2E8F0' },
  cursor: { stroke: '#1E293B' },
}

const METRICS = [
  { key: 'mae',  label: 'MAE',      unit: 'kW', accent: '#06B6D4' },
  { key: 'rmse', label: 'RMSE',     unit: 'kW', accent: '#8B5CF6' },
  { key: 'mape', label: 'MAPE',     unit: '%',  accent: '#F59E0B' },
  { key: 'r2',   label: 'R² Score', unit: '',   accent: '#10B981' },
]

export default function LoadForecasting() {
  const { currentStationId } = useStationStore()

  const { data: forecast, isLoading } = useQuery({
    queryKey: ['load-forecast', currentStationId],
    queryFn: () =>
      api.get(`/api/energy/forecast?station_id=${currentStationId}&horizon=24`).then(r => r.data),
    refetchInterval: 15000,
  })

  // data.metrics.{mae, rmse, mape, r2}
  const metrics = forecast?.metrics ?? {}
  // data.predictions list: {timestamp, actual_kw, predicted_kw, lower_bound, upper_bound, ...}
  const predictions = forecast?.predictions ?? []
  // data.feature_importance list: {feature, importance}
  const featureImportance = forecast?.feature_importance ?? []

  const chartData = predictions.map(d => ({
    time: d.timestamp ? d.timestamp.slice(11, 16) : '',
    predicted_kw: d.predicted_kw,
    actual_kw: d.actual_kw,
    upper_bound: d.upper_bound,
    lower_bound: d.lower_bound,
  }))

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <span className="section-label">AI Forecasting</span>
        <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '1.6rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '-0.4px', lineHeight: 1 }}>
          Load Forecasting
        </h1>
        <p style={{ fontSize: '0.78rem', color: '#475569', marginTop: 5 }}>
          XGBoost model · 24h horizon · Auto-refreshes every 15s
        </p>
      </div>

      {/* Model Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        {METRICS.map(m => {
          const raw = metrics[m.key] ?? null
          const val = raw !== null && raw !== undefined ? Number(raw).toFixed(m.key === 'r2' ? 4 : 2) : '—'
          return (
            <div key={m.key} className="pg-card" style={{ padding: '20px 24px', borderTop: `2px solid ${m.accent}` }}>
              <p style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {m.label}
              </p>
              <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.8rem', fontWeight: 700, color: '#E2E8F0', lineHeight: 1 }}>
                {val}
                {m.unit && <span style={{ fontSize: '0.8rem', color: '#475569', marginLeft: 5 }}>{m.unit}</span>}
              </p>
              <p style={{ fontSize: '0.7rem', color: '#475569', marginTop: 6 }}>
                {m.key === 'mae' && 'Mean Absolute Error'}
                {m.key === 'rmse' && 'Root Mean Sq. Error'}
                {m.key === 'mape' && 'Mean Abs. % Error'}
                {m.key === 'r2' && 'Coefficient of determination'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Forecast Chart with confidence band */}
      <Card title="24-Hour Load Forecast" subtitle="Predicted load with confidence interval" accent="cyan" noPadding>
        <div style={{ padding: '0 18px 18px' }}>
          {isLoading ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: '0.85rem' }}>
              Loading forecast…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 16, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#162032" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#334155', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#334155', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip {...TT} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: '#94A3B8', paddingTop: 8 }}
                />
                {/* Confidence band: upper */}
                <Area
                  type="monotone"
                  dataKey="upper_bound"
                  name="Upper bound"
                  stroke="transparent"
                  fill="#06B6D418"
                  strokeWidth={0}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
                {/* Confidence band: lower */}
                <Area
                  type="monotone"
                  dataKey="lower_bound"
                  name="Lower bound"
                  stroke="transparent"
                  fill="#0A0F1A"
                  strokeWidth={0}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
                {/* Predicted load */}
                <Area
                  type="monotone"
                  dataKey="predicted_kw"
                  name="Predicted Load"
                  stroke="#06B6D4"
                  fill="#06B6D410"
                  strokeWidth={2}
                  dot={false}
                />
                {/* Actual load (past hours) */}
                <Area
                  type="monotone"
                  dataKey="actual_kw"
                  name="Actual Load"
                  stroke="#10B981"
                  fill="#10B98110"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Feature Importance Table */}
      {featureImportance.length > 0 && (
        <Card title="Feature Importance" subtitle="XGBoost top predictive features" accent="purple" noPadding>
          <div style={{ padding: '0 18px 18px' }}>
            <table className="pg-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Importance Score</th>
                  <th>Relative Contribution</th>
                </tr>
              </thead>
              <tbody>
                {featureImportance.slice(0, 10).map((f, i) => {
                  const max = featureImportance[0]?.importance ?? 1
                  const score = f.importance ?? 0
                  const pct = ((score / max) * 100).toFixed(1)
                  return (
                    <tr key={i}>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: '#E2E8F0' }}>
                        {f.feature ?? `feature_${i}`}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#06B6D4' }}>
                        {Number(score).toFixed(4)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: '#1E293B', borderRadius: 3 }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: '#06B6D4', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#94A3B8', minWidth: 38 }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
