import { motion } from 'framer-motion'

/* ─── Dimensions ──────────────────────────────────────────────────────────── */
const NW = 96    // node width
const NH = 60    // node height

/* ─── Layout constants  (viewBox 620 × 310) ──────────────────────────────── */
//  Sources row (top):  Solar x=140  Wind x=270  Diesel x=410
//  Battery (left):     x=16   y=160
//  Bus bar horizontal: y=BUS_Y  spanning from battery right edge to diesel cx
//  Station (right):    x=500   y=118

const SRC = {
  solar:  { x: 140, y: 18 },
  wind:   { x: 270, y: 18 },
  diesel: { x: 410, y: 18 },
}
const BAT   = { x: 16,  y: 158 }   // battery top-left
const BUS_Y = 195                  // bus bar y (horizontal rail)
const STN   = { x: 498, y: 116, w: 108, h: 76 }  // station box

// Centers
const cx = (obj) => (obj.x || SRC[obj]?.x || 0) + NW / 2
const cy = (obj) => (obj.y || SRC[obj]?.y || 0) + NH / 2

/* ─── Source node ─────────────────────────────────────────────────────────── */
function SrcNode({ x, y, label, value, color, active }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={NW} height={NH} rx={5}
        fill={active ? `${color}14` : '#0D1523'}
        stroke={active ? color : '#1E293B'} strokeWidth={active ? 2 : 1} />
      {active && <rect width={NW} height={2.5} rx={5} fill={color} />}
      <text x={NW/2} y={19} textAnchor="middle"
        fill={active ? '#94A3B8' : '#334155'}
        fontSize={8} fontWeight="700" letterSpacing="1.2">
        {label}
      </text>
      <text x={NW/2} y={40} textAnchor="middle"
        fill={active ? color : '#273548'}
        fontSize={17} fontWeight="700" fontFamily="Space Grotesk, sans-serif">
        {value}
      </text>
      <text x={NW/2} y={53} textAnchor="middle" fill="#334155" fontSize={8}>kW</text>
    </g>
  )
}

/* ─── Animated dashed flow line ───────────────────────────────────────────── */
function Flow({ d, color, active, rev = false }) {
  return (
    <>
      <path d={d} fill="none" stroke="#162032" strokeWidth={3} strokeLinejoin="round" />
      {active && (
        <motion.path d={d} fill="none" stroke={color} strokeWidth={2.2}
          strokeDasharray="7 5" strokeLinejoin="round"
          animate={{ strokeDashoffset: rev ? [0, 24] : [24, 0] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'linear' }} />
      )}
    </>
  )
}

/* ─── Arrow tip ───────────────────────────────────────────────────────────── */
function Tip({ x, y, dir, color }) {
  const s = 5
  const pts = {
    down:  `${x},${y+s} ${x-s},${y-s+2} ${x+s},${y-s+2}`,
    right: `${x+s},${y} ${x-s+2},${y-s} ${x-s+2},${y+s}`,
    left:  `${x-s},${y} ${x+s-2},${y-s} ${x+s-2},${y+s}`,
    up:    `${x},${y-s} ${x-s},${y+s-2} ${x+s},${y+s-2}`,
  }
  return <polygon points={pts[dir]} fill={color} opacity={0.9} />
}

/* ─── Main export ─────────────────────────────────────────────────────────── */
export default function EnergyFlowDiagram({ data }) {
  const solar   = data?.solar_kw      ?? 0
  const wind    = data?.wind_kw       ?? 0
  const battery = data?.battery_kw    ?? 0
  const diesel  = data?.diesel_kw     ?? 0
  const load    = data?.total_load_kw ?? 0
  const soc     = data?.battery_soc_pct ?? 0

  const solarOn = solar  > 1
  const windOn  = wind   > 1
  const diesOn  = diesel > 1
  const batDis  = battery > 1
  const batChg  = battery < -1
  const busKw   = Math.round(solar + wind + (batDis ? battery : 0) + diesel)

  // Derived x centres
  const solCX  = SRC.solar.x  + NW / 2   // 188
  const winCX  = SRC.wind.x   + NW / 2   // 318
  const disCX  = SRC.diesel.x + NW / 2   // 458
  const batCY  = BAT.y + NH / 2           // 188  ← battery centre y
  const stnMCX = STN.x + STN.w / 2       // 552  station mid-x
  const stnMCY = STN.y + STN.h / 2       // 154  station mid-y

  // Bus bar endpoints
  const busX1 = BAT.x + NW   // 112  (battery right edge)
  const busX2 = disCX         // 458  (diesel centre)

  // Where station taps into bus bar (right side)
  const tapX  = STN.x         // 498

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 280 }}>
      <svg viewBox="0 0 620 305" style={{ width: '100%', height: '100%', maxHeight: 340 }}>

        {/* ══════════════  FLOW LINES  ══════════════ */}

        {/* Solar  ↓ straight to bus bar */}
        <Flow color="#F59E0B" active={solarOn}
          d={`M ${solCX} ${SRC.solar.y + NH} L ${solCX} ${BUS_Y}`} />
        {solarOn && <Tip x={solCX} y={BUS_Y - 2} dir="down" color="#F59E0B" />}

        {/* Wind   ↓ straight to bus bar */}
        <Flow color="#06B6D4" active={windOn}
          d={`M ${winCX} ${SRC.wind.y + NH} L ${winCX} ${BUS_Y}`} />
        {windOn && <Tip x={winCX} y={BUS_Y - 2} dir="down" color="#06B6D4" />}

        {/* Diesel ↓ straight to bus bar */}
        <Flow color="#94A3B8" active={diesOn} rev
          d={`M ${disCX} ${SRC.diesel.y + NH} L ${disCX} ${BUS_Y}`} />
        {diesOn && <Tip x={disCX} y={BUS_Y - 2} dir="down" color="#94A3B8" />}

        {/* Battery → right to bus bar (horizontal, then drop to bus_y) */}
        <Flow color="#10B981" active={batDis || batChg} rev={batChg}
          d={`M ${BAT.x + NW} ${batCY} L ${busX1 + 20} ${batCY} L ${busX1 + 20} ${BUS_Y}`} />
        {batDis && <Tip x={busX1 + 20} y={BUS_Y - 2} dir="down" color="#10B981" />}
        {batChg && <Tip x={BAT.x + NW + 4} y={batCY} dir="left" color="#10B981" />}

        {/* Bus bar → tap up to Station (right elbow) */}
        <Flow color="#06B6D4" active={load > 0}
          d={`M ${tapX} ${BUS_Y} L ${tapX} ${stnMCY} L ${STN.x} ${stnMCY}`} />
        {load > 0 && <Tip x={STN.x + 4} y={stnMCY} dir="left" color="#06B6D4" />}

        {/* ══════════════  BUS RAIL  ══════════════ */}
        {/* Dark track */}
        <line x1={busX1} y1={BUS_Y} x2={tapX} y2={BUS_Y}
          stroke="#1E293B" strokeWidth={4} />
        {/* Highlighted rail */}
        <line x1={busX1} y1={BUS_Y} x2={tapX} y2={BUS_Y}
          stroke="#273548" strokeWidth={2.5} />
        {/* Rail junction dots */}
        {[solCX, winCX, disCX, busX1 + 20].map((jx, i) => (
          <circle key={i} cx={jx} cy={BUS_Y} r={3.5}
            fill="#273548" stroke="#334155" strokeWidth={1} />
        ))}

        {/* ══════════════  NODES  ══════════════ */}

        {/* Solar */}
        <SrcNode {...SRC.solar} label="SOLAR" value={Math.round(solar)}
          color="#F59E0B" active={solarOn} />

        {/* Wind */}
        <SrcNode {...SRC.wind} label="WIND" value={Math.round(wind)}
          color="#06B6D4" active={windOn} />

        {/* Diesel */}
        <SrcNode {...SRC.diesel} label="DIESEL GEN" value={Math.round(diesel)}
          color="#94A3B8" active={diesOn} />

        {/* Battery */}
        <g transform={`translate(${BAT.x},${BAT.y})`}>
          <rect width={NW} height={NH} rx={5}
            fill={(batDis || batChg) ? '#10B98114' : '#0D1523'}
            stroke={(batDis || batChg) ? '#10B981' : '#1E293B'}
            strokeWidth={(batDis || batChg) ? 2 : 1} />
          {(batDis || batChg) && <rect width={NW} height={2.5} rx={5} fill="#10B981" />}
          <text x={NW/2} y={19} textAnchor="middle"
            fill={(batDis || batChg) ? '#94A3B8' : '#334155'}
            fontSize={8} fontWeight="700" letterSpacing="1">
            {batChg ? 'BATTERY ↑ CHG' : 'BATTERY ↓ DIS'}
          </text>
          <text x={NW/2} y={40} textAnchor="middle"
            fill={(batDis || batChg) ? '#10B981' : '#273548'}
            fontSize={17} fontWeight="700" fontFamily="Space Grotesk, sans-serif">
            {Math.round(Math.abs(battery))}
          </text>
          <text x={NW/2} y={53} textAnchor="middle" fill="#334155" fontSize={8}>kW</text>
        </g>

        {/* SOC bar below battery */}
        <g transform={`translate(${BAT.x},${BAT.y + NH + 5})`}>
          <rect width={NW} height={18} rx={3} fill="#0D1523" stroke="#1E293B" strokeWidth={1} />
          <rect width={NW * Math.min(100, Math.max(0, soc)) / 100} height={18} rx={3}
            fill={soc < 20 ? '#EF444420' : soc < 40 ? '#F59E0B20' : '#10B98120'} />
          <text x={NW/2} y={12.5} textAnchor="middle"
            fill={soc < 20 ? '#EF4444' : soc < 40 ? '#F59E0B' : '#10B981'}
            fontSize={9} fontWeight="700">
            SOC {Math.round(soc)}%
          </text>
        </g>

        {/* Energy Bus label — sits ON the bus bar */}
        <g transform={`translate(${(busX1 + tapX) / 2 - 48}, ${BUS_Y - 32})`}>
          <rect width={96} height={30} rx={4}
            fill="#101827" stroke="#273548" strokeWidth={1.5} />
          <text x={48} y={11} textAnchor="middle"
            fill="#334155" fontSize={7.5} fontWeight="700" letterSpacing="1.2">
            ENERGY BUS
          </text>
          <text x={48} y={25} textAnchor="middle"
            fill="#06B6D4" fontSize={12} fontWeight="700"
            fontFamily="Space Grotesk, sans-serif">
            {busKw} kW
          </text>
        </g>

        {/* Research Station */}
        <g transform={`translate(${STN.x},${STN.y})`}>
          <rect width={STN.w} height={STN.h} rx={6}
            fill="#0D1523" stroke="#06B6D4" strokeWidth={2} />
          <rect width={STN.w} height={2.5} rx={6} fill="#06B6D4" />
          <text x={STN.w/2} y={18} textAnchor="middle"
            fill="#475569" fontSize={7.5} fontWeight="700" letterSpacing="1.2">
            RESEARCH STATION
          </text>
          <text x={STN.w/2} y={50} textAnchor="middle"
            fill="#06B6D4" fontSize={24} fontWeight="700"
            fontFamily="Space Grotesk, sans-serif">
            {Math.round(load)}
          </text>
          <text x={STN.w/2} y={66} textAnchor="middle" fill="#334155" fontSize={8.5}>kW load</text>
        </g>

        {/* ══════════════  LEGEND  ══════════════ */}
        <g transform="translate(16, 278)">
          {[['#F59E0B','Solar'], ['#06B6D4','Wind'], ['#10B981','Battery'], ['#94A3B8','Diesel']].map(([c,l], i) => (
            <g key={l} transform={`translate(${i * 118}, 0)`}>
              <line x1={0} y1={5} x2={20} y2={5} stroke={c} strokeWidth={2} strokeDasharray="6 4" />
              <circle cx={10} cy={5} r={2.5} fill={c} />
              <text x={26} y={9} fill="#334155" fontSize={9} fontFamily="Inter,sans-serif">{l}</text>
            </g>
          ))}
        </g>

      </svg>
    </div>
  )
}
