import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Activity,
  Loader,
  Play,
} from 'lucide-react';
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

// ── Tier config ────────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  1: {
    label: 'CRITICAL',
    color: C.red,
    badge: 'NEVER SHED',
    badgeSubtitle: 'Life Support',
    emoji: '🔴',
  },
  2: {
    label: 'OPERATIONAL',
    color: C.amber,
    badge: 'EMERGENCY ONLY',
    badgeSubtitle: 'Emergency Only',
    emoji: '🟡',
  },
  3: {
    label: 'DEFERRABLE',
    color: C.muted,
    badge: 'SHED FIRST',
    badgeSubtitle: 'Shed First',
    emoji: '⚪',
  },
};

// ── Sub-components ─────────────────────────────────────────────────────────────
const LoadingSpinner = ({ message = 'Loading…' }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 200,
      gap: 12,
    }}
  >
    <Loader size={30} color={C.cyan} style={{ animation: 'spin 1s linear infinite' }} />
    <span style={{ color: C.muted, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>{message}</span>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ErrorBanner = ({ message }) => (
  <div
    style={{
      background: `${C.red}15`,
      border: `1px solid ${C.red}`,
      borderRadius: 10,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '16px 0',
    }}
  >
    <AlertTriangle size={18} color={C.red} />
    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.red }}>{message}</span>
  </div>
);

const TierBadge = ({ tier }) => {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG[3];
  return (
    <span
      style={{
        background: `${cfg.color}25`,
        color: cfg.color,
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 12,
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700,
        border: `1px solid ${cfg.color}50`,
        whiteSpace: 'nowrap',
      }}
    >
      T{tier}
    </span>
  );
};

const LoadRow = ({ load }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '7px 0',
      borderBottom: `1px solid ${C.border}`,
    }}
  >
    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.text, flex: 1 }}>
      {load.name ?? load.load_name ?? load.equipment_name ?? 'Unknown'}
    </span>
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 13,
        fontWeight: 700,
        color: C.cyan,
        marginLeft: 12,
      }}
    >
      {Number(load.power_kw ?? load.kw ?? load.rated_power_kw ?? 0).toFixed(1)} kW
    </span>
  </div>
);

const TierCard = ({ tier, loads = [], totalKw }) => {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG[3];
  const total =
    totalKw ??
    loads.reduce((s, l) => s + Number(l.power_kw ?? l.kw ?? l.rated_power_kw ?? 0), 0);

  return (
    <div
      style={{
        background: C.card,
        border: `2px solid ${cfg.color}`,
        borderRadius: 12,
        padding: '18px 20px',
        flex: 1,
        minWidth: 220,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
        <div>
          <div
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              color: cfg.color,
            }}
          >
            Tier {tier} — {cfg.label}
          </div>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'JetBrains Mono, monospace',
              color: cfg.color,
              background: `${cfg.color}20`,
              display: 'inline-block',
              padding: '1px 7px',
              borderRadius: 10,
              marginTop: 2,
            }}
          >
            {cfg.badge}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 18,
              fontWeight: 700,
              color: cfg.color,
            }}
          >
            {total.toFixed(1)}
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>kW total</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderBottom: `1px solid ${C.border}`, margin: '10px 0' }} />

      {/* Loads list */}
      {loads.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 12, fontFamily: 'Inter, sans-serif', padding: '8px 0' }}>
          No loads assigned to this tier.
        </div>
      ) : (
        loads.map((load, i) => <LoadRow key={load.id ?? load.load_id ?? i} load={load} />)
      )}
    </div>
  );
};

// ── Deficit Simulator ──────────────────────────────────────────────────────────
const DeficitSimulator = () => {
  const [generation, setGeneration] = useState('');
  const [demand, setDemand] = useState('');
  const [simResult, setSimResult] = useState(null);

  const simulateMutation = useMutation({
    mutationFn: (payload) =>
      api.post('/api/safety/load-shedding/simulate', payload).then((r) => r.data),
    onSuccess: (data) => setSimResult(data),
    onError: (err) => setSimResult({ error: err?.message ?? 'Simulation failed' }),
  });

  const handleSimulate = () => {
    const gen = parseFloat(generation);
    const dem = parseFloat(demand);
    if (isNaN(gen) || isNaN(dem)) return;
    const deficit = Math.max(0, dem - gen);
    setSimResult(null);
    simulateMutation.mutate({ power_deficit_kw: deficit, scenario: 'normal' });
  };

  const inputStyle = {
    background: '#0A0F1A',
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: C.text,
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 14,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '20px 24px',
        marginTop: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Activity size={16} color={C.purple} />
        <h2
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 15,
            fontWeight: 700,
            color: C.text,
            margin: 0,
          }}
        >
          Deficit Simulator
        </h2>
        <span
          style={{
            marginLeft: 8,
            background: `${C.purple}25`,
            color: C.purple,
            fontSize: 10,
            padding: '2px 10px',
            borderRadius: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          WHAT-IF ANALYSIS
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              color: C.muted,
              fontFamily: 'Inter, sans-serif',
              marginBottom: 6,
            }}
          >
            Generation (kW)
          </label>
          <input
            type="number"
            value={generation}
            onChange={(e) => setGeneration(e.target.value)}
            placeholder="e.g. 120"
            style={inputStyle}
          />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              color: C.muted,
              fontFamily: 'Inter, sans-serif',
              marginBottom: 6,
            }}
          >
            Demand (kW)
          </label>
          <input
            type="number"
            value={demand}
            onChange={(e) => setDemand(e.target.value)}
            placeholder="e.g. 180"
            style={inputStyle}
          />
        </div>
        <button
          onClick={handleSimulate}
          disabled={simulateMutation.isPending || !generation || !demand}
          style={{
            background: C.purple,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 22px',
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            cursor: simulateMutation.isPending ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: simulateMutation.isPending ? 0.7 : 1,
            whiteSpace: 'nowrap',
            minWidth: 160,
            justifyContent: 'center',
          }}
        >
          {simulateMutation.isPending ? (
            <>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Simulating…
            </>
          ) : (
            <>
              <Play size={14} /> Simulate Shedding
            </>
          )}
        </button>
      </div>

      {/* Deficit preview */}
      {generation && demand && (
        <div style={{ marginTop: 10, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: C.muted }}>
          Deficit:{' '}
          <span style={{ color: parseFloat(demand) > parseFloat(generation) ? C.red : C.green }}>
            {Math.max(0, parseFloat(demand) - parseFloat(generation)).toFixed(1)} kW
          </span>
        </div>
      )}

      {/* Simulation Result */}
      {simResult && (
        <div
          style={{
            marginTop: 16,
            background: simResult.error ? `${C.red}10` : `${C.cyan}10`,
            border: `1px solid ${simResult.error ? C.red : C.cyan}`,
            borderRadius: 10,
            padding: '16px 18px',
          }}
        >
          {simResult.error ? (
            <div style={{ color: C.red, fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
              ❌ {simResult.error}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {simResult.is_life_safe !== false ? (
                  <CheckCircle size={16} color={C.green} />
                ) : (
                  <XCircle size={16} color={C.red} />
                )}
                <span
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 13,
                    fontWeight: 700,
                    color: simResult.is_life_safe !== false ? C.green : C.red,
                  }}
                >
                  {simResult.is_life_safe !== false ? 'Life-Safe Plan Found' : 'UNSAFE — Critical loads at risk'}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 12,
                    color: C.cyan,
                  }}
                >
                  Recovered: {Number(simResult.total_recovered_kw ?? simResult.power_recovered_kw ?? 0).toFixed(1)} kW
                </span>
              </div>

              {(simResult.shed_sequence ?? simResult.loads_to_shed ?? []).map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '5px 0',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 11,
                      color: C.muted,
                      minWidth: 20,
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <TierBadge tier={item.tier ?? item.priority_tier} />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.text, flex: 1 }}>
                    {item.load_name ?? item.name ?? 'Unknown load'}
                  </span>
                  <span
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.amber,
                    }}
                  >
                    -{Number(item.power_kw ?? item.kw ?? 0).toFixed(1)} kW
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LoadShedding() {
  const { currentStationId } = useStationStore();

  // Status query
  const {
    data: statusData,
    isLoading: statusLoading,
    isError: statusError,
    error: statusErr,
  } = useQuery({
    queryKey: ['load-shedding-status', currentStationId],
    queryFn: () =>
      api
        .get(`/api/safety/load-shedding/status?station_id=${currentStationId}`)
        .then((r) => r.data),
    refetchInterval: 30000,
    retry: 2,
  });

  // Loads list query
  const {
    data: loadsData,
    isLoading: loadsLoading,
    isError: loadsError,
    error: loadsErr,
  } = useQuery({
    queryKey: ['load-shedding-loads', currentStationId],
    queryFn: () =>
      api
        .get(`/api/safety/load-shedding/loads?station_id=${currentStationId}`)
        .then((r) => r.data),
    retry: 2,
  });

  // Parse data
  const sheddingActive = statusData?.shedding_active ?? false;
  const assessState = statusData?.assess_current_state ?? statusData?.shedding_plan ?? null;
  const shedSequence =
    assessState?.shed_sequence ??
    assessState?.loads_to_shed ??
    statusData?.shed_sequence ??
    [];
  const isLifeSafe =
    assessState?.is_life_safe ?? statusData?.is_life_safe ?? true;
  const powerDeficit =
    assessState?.power_deficit_kw ?? statusData?.power_deficit_kw ?? 0;
  const totalRecovered =
    assessState?.total_recovered_kw ??
    assessState?.power_recovered_kw ??
    statusData?.total_recovered_kw ??
    0;

  // Tier breakdown from loads API
  const allLoads = loadsData?.loads ?? loadsData ?? [];
  const byTier = (tier) =>
    Array.isArray(allLoads) ? allLoads.filter((l) => (l.tier ?? l.priority_tier) === tier) : [];

  const tier1Loads = byTier(1);
  const tier2Loads = byTier(2);
  const tier3Loads = byTier(3);

  // Fallback totals from status if loads not loaded
  const criticalKw = statusData?.critical_kw ?? loadsData?.critical_kw;
  const operationalKw = statusData?.operational_kw ?? loadsData?.operational_kw;
  const deferrableKw = statusData?.deferrable_kw ?? loadsData?.deferrable_kw;

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
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 26,
            fontWeight: 700,
            color: C.text,
            margin: 0,
          }}
        >
          🛡️ Automated Load Shedding
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '6px 0 0', fontFamily: 'Inter, sans-serif' }}>
          Polar Life-Safety Priority System — 3-Tier Load Classification
        </p>
      </div>

      {/* ── Status Banner ── */}
      {statusLoading ? (
        <LoadingSpinner message="Checking load shedding status…" />
      ) : statusError ? (
        <ErrorBanner message={`Status fetch failed: ${statusErr?.message ?? 'Unknown error'}`} />
      ) : (
        <div
          style={{
            background: sheddingActive ? `${C.red}15` : `${C.green}15`,
            border: `2px solid ${sheddingActive ? C.red : C.green}`,
            borderRadius: 12,
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 24,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {sheddingActive ? (
            <>
              <AlertTriangle size={24} color={C.red} />
              <div>
                <div
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: 15,
                    fontWeight: 700,
                    color: C.red,
                  }}
                >
                  ⚠ LOAD SHEDDING ACTIVE — See shed plan below
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  Deficit: {Number(powerDeficit).toFixed(1)} kW | Recovered:{' '}
                  {Number(totalRecovered).toFixed(1)} kW
                </div>
              </div>
              {/* Pulsing dot */}
              <span
                style={{
                  marginLeft: 'auto',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: C.red,
                  boxShadow: `0 0 0 4px ${C.red}40`,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <style>
                {`@keyframes pulse { 0%,100%{box-shadow:0 0 0 4px ${C.red}40} 50%{box-shadow:0 0 0 8px ${C.red}20} }`}
              </style>
            </>
          ) : (
            <>
              <CheckCircle size={24} color={C.green} />
              <div
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.green,
                }}
              >
                ✓ All Systems Normal — No Load Shedding Required
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 3 Tier Cards ── */}
      {loadsLoading ? (
        <LoadingSpinner message="Loading load classification…" />
      ) : loadsError ? (
        <ErrorBanner message={`Loads fetch failed: ${loadsErr?.message ?? 'Unknown error'}`} />
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <TierCard tier={1} loads={tier1Loads} totalKw={criticalKw} />
          <TierCard tier={2} loads={tier2Loads} totalKw={operationalKw} />
          <TierCard tier={3} loads={tier3Loads} totalKw={deferrableKw} />
        </div>
      )}

      {/* ── Shedding Plan ── */}
      {sheddingActive && shedSequence.length > 0 && (
        <div
          style={{
            background: C.card,
            border: `2px solid ${C.red}`,
            borderRadius: 12,
            padding: '20px 24px',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Zap size={16} color={C.red} />
            <h2
              style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                color: C.red,
                margin: 0,
              }}
            >
              Active Shedding Plan
            </h2>
            {/* Life-safe badge */}
            <span
              style={{
                marginLeft: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: isLifeSafe ? `${C.green}20` : `${C.red}20`,
                border: `1px solid ${isLifeSafe ? C.green : C.red}`,
                color: isLifeSafe ? C.green : C.red,
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 12,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
              }}
            >
              {isLifeSafe ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {isLifeSafe ? 'LIFE-SAFE' : 'UNSAFE'}
            </span>
          </div>

          {/* Summary row */}
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginBottom: 14,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
            }}
          >
            <span style={{ color: C.muted }}>
              Deficit:{' '}
              <span style={{ color: C.red }}>{Number(powerDeficit).toFixed(1)} kW</span>
            </span>
            <span style={{ color: C.muted }}>
              Recovered:{' '}
              <span style={{ color: C.green }}>{Number(totalRecovered).toFixed(1)} kW</span>
            </span>
            <span style={{ color: C.muted }}>
              Balance:{' '}
              <span
                style={{
                  color: totalRecovered >= powerDeficit ? C.green : C.amber,
                }}
              >
                {(totalRecovered - powerDeficit).toFixed(1)} kW
              </span>
            </span>
          </div>

          {/* Sequence list */}
          {shedSequence.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  color: C.muted,
                  minWidth: 22,
                  textAlign: 'right',
                }}
              >
                #{item.order ?? item.sequence_order ?? idx + 1}
              </span>
              <TierBadge tier={item.tier ?? item.priority_tier} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: C.text, flex: 1 }}>
                {item.load_name ?? item.name ?? 'Unknown load'}
              </span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.amber,
                }}
              >
                -{Number(item.power_kw ?? item.kw ?? 0).toFixed(1)} kW
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Deficit Simulator ── */}
      <DeficitSimulator />
    </div>
  );
}
