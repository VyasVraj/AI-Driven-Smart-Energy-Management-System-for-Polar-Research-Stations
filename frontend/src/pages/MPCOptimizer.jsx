import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Zap, Clock, RefreshCw, AlertTriangle, Info, Cpu, Loader } from 'lucide-react';
import api from '../services/api';
import useStationStore from '../store/stationStore';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0F1A',
  card: '#0D1523',
  border: '#1E293B',
  cyan: '#06B6D4',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  text: '#E2E8F0',
  muted: '#64748B',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (v, dec = 1) => (v == null ? '—' : Number(v).toFixed(dec));

const InfoCard = ({ label, value, icon: Icon }) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 200,
    }}
  >
    {Icon && <Icon size={18} color={C.cyan} />}
    <div>
      <div style={{ fontSize: 11, color: C.muted, fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: C.text, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
        {value}
      </div>
    </div>
  </div>
);

const MetricTile = ({ label, value, unit, color }) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '14px 18px',
      flex: 1,
      minWidth: 130,
      textAlign: 'center',
    }}
  >
    <div
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 22,
        fontWeight: 700,
        color: color || C.cyan,
      }}
    >
      {value}
      {unit && (
        <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 3, color: C.muted }}>{unit}</span>
      )}
    </div>
    <div style={{ fontSize: 11, color: C.muted, fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
      {label}
    </div>
  </div>
);

const CommandRow = ({ label, value, unit = 'kW', color }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 0',
      borderBottom: `1px solid ${C.border}`,
    }}
  >
    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.muted }}>{label}</span>
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 14,
        fontWeight: 700,
        color: color || C.text,
      }}
    >
      {fmt(value)} <span style={{ fontSize: 11, color: C.muted }}>{unit}</span>
    </span>
  </div>
);

const LoadingSpinner = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 300,
      gap: 16,
      color: C.muted,
    }}
  >
    <Loader size={36} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14 }}>Running MPC optimization…</span>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ErrorCard = ({ message }) => (
  <div
    style={{
      background: `${C.red}15`,
      border: `1px solid ${C.red}`,
      borderRadius: 10,
      padding: 24,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '24px 0',
    }}
  >
    <AlertTriangle size={20} color={C.red} />
    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: C.red }}>{message}</span>
  </div>
);

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const DispatchTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
      }}
    >
      <div style={{ color: C.muted, marginBottom: 6 }}>Hour {label}:00</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.fill || p.stroke, marginBottom: 2 }}>
          {p.name}: {fmt(p.value)} kW
        </div>
      ))}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function MPCOptimizer() {
  const { currentStationId } = useStationStore();

  const { data, isLoading, isError, error, dataUpdatedAt } = useQuery({
    queryKey: ['mpc-optimize', currentStationId],
    queryFn: () =>
      api.get(`/api/mpc/optimize?station_id=${currentStationId}`).then((r) => r.data),
    refetchInterval: 300000,
    retry: 2,
  });

  // ── Derived data ─────────────────────────────────────────────────────────────
  const schedule = data?.hourly_schedule ?? [];
  const commands = data?.current_step_commands ?? {};
  const summary = data?.summary_metrics ?? {};
  const socTraj = data?.soc_trajectory ?? [];
  const explanation =
    data?.rolling_horizon_explanation ??
    'Model Predictive Control (MPC) uses a receding horizon strategy. At each interval, ' +
      'the optimizer solves a Mixed-Integer Linear Program (MILP) over the next 24 hours, ' +
      'then executes only the first hour\'s commands before re-solving with updated forecasts. ' +
      'This allows the system to continuously adapt to changing weather, load, and grid conditions ' +
      'while ensuring long-term battery health and fuel economy.';

  // Build chart data arrays
  const dispatchData = schedule.map((h) => ({
    hour: h.hour ?? h.t,
    Solar: h.solar_kw ?? 0,
    Wind: h.wind_kw ?? 0,
    'Batt. Discharge': h.battery_discharge_kw ?? 0,
    Diesel: h.diesel_kw ?? 0,
    load_shed: h.load_shed_kw ?? 0,
  }));

  const socData = socTraj.map((s) => ({
    hour: s.hour ?? s.t,
    SOC: s.soc_pct ?? s.soc ?? 0,
  }));

  // Fallback: derive SOC from schedule if trajectory not returned
  const socChartData =
    socData.length > 0
      ? socData
      : schedule.map((h) => ({ hour: h.hour ?? h.t, SOC: h.soc_pct ?? 0 }));

  const hasLoadShed = dispatchData.some((d) => d.load_shed > 0);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : '—';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        padding: '28px 32px',
        fontFamily: 'Inter, sans-serif',
        color: C.text,
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 26,
            fontWeight: 700,
            color: C.text,
            margin: 0,
          }}
        >
          ⚡ MPC Optimizer
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '6px 0 0', fontFamily: 'Inter, sans-serif' }}>
          Model Predictive Control — 24-Hour Optimal Dispatch Plan
        </p>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
          Last updated: {lastUpdated}
        </div>
      </div>

      {/* ── Top Info Bar ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <InfoCard label="Optimization Method" value="MILP + Receding Horizon" icon={Cpu} />
        <InfoCard label="Planning Horizon" value="24 Hours" icon={Clock} />
        <InfoCard label="Replan Interval" value="Every 60 min" icon={RefreshCw} />
      </div>

      {/* ── Loading / Error ── */}
      {isLoading && <LoadingSpinner />}
      {isError && (
        <ErrorCard
          message={`Failed to load MPC optimization: ${error?.message ?? 'Unknown error'}`}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {/* ── Execute NOW Commands ── */}
          <div
            style={{
              background: C.card,
              border: `2px solid ${C.green}`,
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <Zap size={18} color={C.green} />
              <span
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                Execute NOW — Current Hour Commands
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  background: `${C.green}25`,
                  color: C.green,
                  fontSize: 11,
                  padding: '2px 10px',
                  borderRadius: 20,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 700,
                }}
              >
                ACTIVE SETPOINTS
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              <div>
                <CommandRow label="☀️ Solar Output" value={commands.solar_kw} color={C.amber} />
                <CommandRow label="💨 Wind Output" value={commands.wind_kw} color={C.cyan} />
                <CommandRow label="🔋 Battery Discharge" value={commands.battery_discharge_kw} color={C.purple} />
              </div>
              <div>
                <CommandRow label="🔌 Diesel Generator" value={commands.diesel_kw} color={C.red} />
                <CommandRow label="⚡ Battery Charge" value={commands.battery_charge_kw} color={C.green} />
                {commands.load_shed_kw > 0 && (
                  <CommandRow label="⚠️ Load Shed" value={commands.load_shed_kw} color={C.red} />
                )}
              </div>
            </div>
          </div>

          {/* ── 24-Hour Dispatch Chart ── */}
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
                margin: '0 0 16px',
              }}
            >
              📊 24-Hour Optimal Dispatch Schedule
            </h2>
            {dispatchData.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 40 }}>
                No schedule data returned by optimizer.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dispatchData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: C.muted, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis
                    tick={{ fill: C.muted, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(v) => `${v}`}
                    label={{
                      value: 'kW',
                      angle: -90,
                      position: 'insideLeft',
                      fill: C.muted,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip content={<DispatchTooltip />} />
                  <Legend
                    wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.muted }}
                  />
                  <Bar dataKey="Solar" stackId="gen" fill={C.amber} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Wind" stackId="gen" fill={C.cyan} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Batt. Discharge" stackId="gen" fill={C.purple} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Diesel" stackId="gen" fill={C.red} radius={[4, 4, 0, 0]} />
                  {hasLoadShed && (
                    <Line
                      type="monotone"
                      dataKey="load_shed"
                      name="Load Shed"
                      stroke={C.red}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                      dot={false}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Summary Metrics ── */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 24,
            }}
          >
            <MetricTile
              label="Total Fuel"
              value={fmt(summary.total_fuel_liters, 0)}
              unit="L"
              color={C.red}
            />
            <MetricTile
              label="CO₂ Saved vs Baseline"
              value={fmt(summary.co2_saved_kg, 0)}
              unit="kg"
              color={C.green}
            />
            <MetricTile
              label="Renewable %"
              value={fmt(summary.renewable_pct, 1)}
              unit="%"
              color={C.cyan}
            />
            <MetricTile
              label="Min SOC"
              value={fmt(summary.min_soc_pct, 1)}
              unit="%"
              color={C.amber}
            />
            <MetricTile
              label="Diesel Runtime"
              value={fmt(summary.diesel_runtime_hours, 1)}
              unit="h"
              color={C.red}
            />
            <MetricTile
              label="Battery Cycles"
              value={fmt(summary.battery_cycles, 2)}
              unit=""
              color={C.purple}
            />
          </div>

          {/* ── SOC Trajectory ── */}
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 24,
            }}
          >
            <h2
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
                margin: '0 0 16px',
              }}
            >
              🔋 Battery SOC Trajectory (24h)
            </h2>
            {socChartData.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: 40 }}>
                No SOC trajectory data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={socChartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: C.muted, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: C.muted, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 12,
                    }}
                    formatter={(v) => [`${fmt(v, 1)}%`, 'SOC']}
                    labelFormatter={(l) => `Hour ${l}:00`}
                  />
                  <Legend
                    wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: C.muted }}
                  />
                  {/* Danger floor */}
                  <ReferenceLine
                    y={20}
                    stroke={C.red}
                    strokeDasharray="6 3"
                    label={{
                      value: 'Danger Floor 20%',
                      fill: C.red,
                      fontSize: 10,
                      fontFamily: 'Inter, sans-serif',
                      position: 'insideTopRight',
                    }}
                  />
                  {/* Max ceiling */}
                  <ReferenceLine
                    y={90}
                    stroke={C.green}
                    strokeDasharray="6 3"
                    label={{
                      value: 'Max 90%',
                      fill: C.green,
                      fontSize: 10,
                      fontFamily: 'Inter, sans-serif',
                      position: 'insideBottomRight',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="SOC"
                    stroke={C.cyan}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: C.cyan }}
                    activeDot={{ r: 5 }}
                    name="Battery SOC"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── MPC Explanation ── */}
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '20px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Info size={16} color={C.cyan} />
              <h2
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.text,
                  margin: 0,
                }}
              >
                About This Optimization
              </h2>
            </div>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 13,
                color: C.muted,
                lineHeight: 1.8,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {explanation}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
