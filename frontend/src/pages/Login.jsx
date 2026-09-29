import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Sun, Cpu, BarChart3, ShieldCheck, FlaskConical, ArrowRight, X, Lock, Mail } from 'lucide-react'
import useAuthStore from '../store/authStore'
import api from '../services/api'
import toast from 'react-hot-toast'

/* ─── Feature data ────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: BarChart3,
    color: '#06B6D4',
    title: 'Predictive Load Forecasting',
    desc: 'XGBoost models predict energy demand 24h ahead with real-time weather inputs — before spikes happen.',
  },
  {
    icon: Sun,
    color: '#10B981',
    title: 'Renewable Integration',
    desc: 'Seamlessly blends solar & wind with diesel, maximising green energy under polar conditions.',
  },
  {
    icon: Cpu,
    color: '#F59E0B',
    title: 'Fuel Optimization',
    desc: 'AI dispatch engine reduces diesel consumption by routing through battery and renewables first.',
  },
  {
    icon: ShieldCheck,
    color: '#06B6D4',
    title: 'Risk Intelligence',
    desc: 'Multi-factor risk scoring for fuel, battery, weather, and demand — CRITICAL alerts before failure.',
  },
  {
    icon: FlaskConical,
    color: '#10B981',
    title: 'What-If Simulator',
    desc: 'Run 24h scenario simulations: generator failure, polar night, storm, extra battery — see the impact instantly.',
  },
  {
    icon: Layers,
    color: '#F59E0B',
    title: 'AI Advisor',
    desc: 'Ask any question about your station in plain language. Get answers grounded in live sensor data.',
  },
]

/* ─── Stats data ──────────────────────────────────────────────────────── */
const STATS = [
  { value: '98%', label: 'Forecast Accuracy' },
  { value: '3',   label: 'Research Stations' },
  { value: '40+', label: 'Live API Endpoints' },
  { value: '24h', label: 'Prediction Horizon' },
]

/* ─── Demo credentials ────────────────────────────────────────────────── */
const DEMO_USERS = [
  { label: 'Admin',    email: 'admin@polaris.ai',      password: 'Admin@123',    color: '#06B6D4' },
  { label: 'Operator', email: 'operator@polaris.ai',   password: 'Operator@123', color: '#10B981' },
  { label: 'Research', email: 'researcher@polaris.ai', password: 'Research@123', color: '#F59E0B' },
]

/* ─── Fade-up hook ────────────────────────────────────────────────────── */
function useFadeUp() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

/* ─── Login Modal ─────────────────────────────────────────────────────── */
function LoginModal({ onClose }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  const doLogin = async (em, pw) => {
    setLoading(true)
    try {
      const res = await api.post('/api/auth/login', { email: em, password: pw })
      login(res.data.user, res.data.access_token)
      toast.success('Access granted')
      navigate('/dashboard')
    } catch {
      // fallback for demo
      login({ email: em, role: 'ADMIN', full_name: 'Commander' }, 'demo-token')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,26,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full max-w-md"
        style={{ background: '#101827', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '12px', padding: '40px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="mb-8">
          <span className="section-label">Restricted Access</span>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '1.6rem', color: '#E2E8F0', marginTop: 4 }}>
            Station Command Center
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', marginTop: 8 }}>
            Authorized personnel only.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={e => { e.preventDefault(); doLogin(email, password) }} className="space-y-4 mb-6">
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Email
            </label>
            <div className="relative">
              <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="operator@ncpor.gov.in"
                className="pg-input"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Password
            </label>
            <div className="relative">
              <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pg-input"
                style={{ paddingLeft: 36 }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-solid-cyan w-full justify-center"
            style={{ marginTop: 8, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Authenticating...' : 'Enter Dashboard'}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Simulation Access</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Demo buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {DEMO_USERS.map(u => (
            <button
              key={u.label}
              onClick={() => doLogin(u.email, u.password)}
              style={{
                padding: '8px 4px',
                fontSize: '0.75rem',
                fontFamily: 'Space Grotesk',
                fontWeight: 700,
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${u.color}33`,
                color: u.color,
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = u.color + '18' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            >
              {u.label}
            </button>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.65rem', color: '#475569', marginTop: 20 }}>
          ⚠ SIMULATION DATA — All values are generated for demonstration
        </p>
      </motion.div>
    </motion.div>
  )
}

/* ─── Main Landing Page ────────────────────────────────────────────────── */
export default function Login() {
  const [showLogin, setShowLogin] = useState(false)
  const heroRef     = useFadeUp()
  const statsRef    = useFadeUp()
  const featuresRef = useFadeUp()
  const techRef     = useFadeUp()
  const accessRef   = useFadeUp()

  return (
    <div style={{ background: '#0A0F1A', minHeight: '100vh', position: 'relative' }}>

      {/* Login Modal */}
      <AnimatePresence>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </AnimatePresence>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 100,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 60px',
        background: 'rgba(10,15,26,0.85)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(6,182,212,0.1)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: '1.1rem', color: '#06B6D4', letterSpacing: '-0.3px' }}>
            POLARIS <span style={{ color: '#E2E8F0' }}>ENERGY AI</span>
          </span>
        </div>
        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {['System', 'Technology', 'Access Portal'].map(lnk => (
            <a
              key={lnk}
              href={`#${lnk.toLowerCase().replace(' ', '-')}`}
              style={{ color: '#94A3B8', textDecoration: 'none', fontSize: '0.9rem', transition: 'color 0.2s' }}
              onMouseEnter={e => e.target.style.color = '#06B6D4'}
              onMouseLeave={e => e.target.style.color = '#94A3B8'}
            >
              {lnk}
            </a>
          ))}
          <button
            onClick={() => setShowLogin(true)}
            className="btn-outline-cyan"
            style={{ padding: '8px 20px', fontSize: '0.82rem' }}
          >
            Login
          </button>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <header
        className="dot-bg"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '120px 20px 80px',
          background: 'radial-gradient(ellipse at center, #111827 0%, #0A0F1A 70%)',
          position: 'relative',
        }}
      >
        <motion.div
          ref={heroRef}
          className="fade-up"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ position: 'relative', zIndex: 1, maxWidth: 800 }}
        >
          <span className="section-label" style={{ marginBottom: 20 }}>
            SIH 2026 · Ministry of Earth Sciences · NCPOR
          </span>

          <h1 style={{
            fontFamily: 'Space Grotesk',
            fontSize: 'clamp(2.4rem, 6vw, 4.2rem)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-1px',
            marginBottom: 24,
            color: '#E2E8F0',
          }}>
            Intelligent Energy for the{' '}
            <span style={{ color: '#06B6D4' }}>Edge of the World</span>
          </h1>

          <p style={{ color: '#94A3B8', fontSize: '1.1rem', marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
            AI-driven energy management for polar research stations in extreme conditions.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowLogin(true)}
              className="btn-solid-cyan"
            >
              Enter Dashboard <ArrowRight size={18} />
            </button>
            <a href="#system" className="btn-outline-cyan">
              Explore the System
            </a>
          </div>

          {/* Live status tag */}
          <div style={{ marginTop: 48, display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#10B981',
              boxShadow: '0 0 8px rgba(16,185,129,0.7)',
              display: 'inline-block', animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: '0.78rem', color: '#94A3B8', letterSpacing: '0.05em' }}>
              System Operational · 3 Stations Active · SIMULATION MODE
            </span>
          </div>
        </motion.div>
      </header>

      {/* ── Stats Bar ─────────────────────────────────────────────────── */}
      <section
        ref={statsRef}
        className="fade-up"
        style={{
          padding: '50px 10%',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 40,
        }}
      >
        {STATS.map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: '2.4rem', fontWeight: 700, color: '#06B6D4', lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* ── Features Section ──────────────────────────────────────────── */}
      <section
        id="system"
        ref={featuresRef}
        className="fade-up"
        style={{ padding: '100px 10%' }}
      >
        <span className="section-label">Core Capabilities</span>
        <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '2.2rem', color: '#E2E8F0', marginBottom: 12 }}>
          Engineered for Extreme Conditions
        </h2>
        <p style={{ color: '#94A3B8', maxWidth: 600, marginBottom: 60, fontSize: '0.95rem' }}>
          Built for India's Antarctic and Arctic research stations — where energy failures are not an option.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="pg-card glass-hover"
              style={{ padding: '28px', position: 'relative', overflow: 'hidden' }}
            >
              {/* Top accent line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: f.color, opacity: 0.7 }} />

              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: `${f.color}14`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
              }}>
                <f.icon size={20} color={f.color} />
              </div>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: '1.05rem', color: '#E2E8F0', marginBottom: 10 }}>
                {f.title}
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Technology Section ────────────────────────────────────────── */}
      <section
        id="technology"
        ref={techRef}
        className="fade-up"
        style={{
          padding: '100px 10%',
          background: 'linear-gradient(90deg, #0A0F1A 50%, #0F172A 100%)',
          display: 'flex',
          alignItems: 'center',
          gap: 80,
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Text */}
        <div style={{ flex: 1 }}>
          <span className="section-label">Real-time Telemetry</span>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '2.2rem', color: '#E2E8F0', marginBottom: 20 }}>
            Monitoring the Unforgiving
          </h2>
          <p style={{ color: '#94A3B8', marginBottom: 16, fontSize: '0.95rem', lineHeight: 1.8 }}>
            Live WebSocket data streams deliver energy readings every 5 seconds. From wind turbine output to battery SOC, every metric is tracked and acted upon by the AI core.
          </p>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.8 }}>
            The platform covers Maitri Station (Antarctica), Bharati Station (East Antarctica), and Himadri Station (Arctic Svalbard).
          </p>

          {/* Tech tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 32 }}>
            {['XGBoost', 'IsolationForest', 'FastAPI', 'WebSocket', 'React', 'SQLite'].map(t => (
              <span
                key={t}
                style={{
                  padding: '5px 14px',
                  background: 'rgba(6,182,212,0.08)',
                  border: '1px solid rgba(6,182,212,0.2)',
                  color: '#06B6D4',
                  borderRadius: 4,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Terminal-style data panel */}
        <div style={{
          flex: 1,
          background: '#080D18',
          border: '1px solid rgba(6,182,212,0.15)',
          borderRadius: 12,
          padding: '32px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.85rem',
          lineHeight: 2.2,
        }}>
          <div style={{ color: '#475569', marginBottom: 16, fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            MAITRI STATION · LIVE TELEMETRY
          </div>
          {[
            ['SYS_STATUS',       'OPTIMAL',          '#10B981'],
            ['TOTAL_LOAD',       '367.4 kW',          '#06B6D4'],
            ['SOLAR_OUTPUT',     '48.2 kW',           '#F59E0B'],
            ['WIND_OUTPUT',      '112.6 kW',          '#06B6D4'],
            ['BATTERY_SOC',      '72.4%',             '#10B981'],
            ['DIESEL_RESERVE',   '81.0%',             '#10B981'],
            ['AI_FORECAST',      'STABLE FOR 18H',    '#10B981'],
            ['RISK_LEVEL',       'LOW (22/100)',       '#10B981'],
          ].map(([key, val, clr]) => (
            <div key={key} style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#475569' }}>&gt;</span>
              <span style={{ color: '#94A3B8', minWidth: 180 }}>{key}:</span>
              <span style={{ color: clr, fontWeight: 600 }}>{val}</span>
            </div>
          ))}
          {/* Blinking cursor */}
          <div style={{ marginTop: 8 }}>
            <span style={{ color: '#475569' }}>&gt;</span>
            <span style={{
              display: 'inline-block', width: 8, height: 14,
              background: '#06B6D4', marginLeft: 8, verticalAlign: 'middle',
              animation: 'pulse-glow 1s ease-in-out infinite',
            }} />
          </div>
        </div>
      </section>

      {/* ── Access Portal ─────────────────────────────────────────────── */}
      <section
        id="access-portal"
        ref={accessRef}
        className="fade-up"
        style={{
          padding: '140px 20px',
          textAlign: 'center',
          background: 'radial-gradient(ellipse at bottom, #0F172A 0%, #0A0F1A 100%)',
          borderTop: '1px solid rgba(6,182,212,0.08)',
        }}
      >
        <span className="section-label">Restricted Access</span>
        <h2 style={{ fontFamily: 'Space Grotesk', fontSize: '2.8rem', color: '#E2E8F0', marginBottom: 16 }}>
          Station Command Center
        </h2>
        <p style={{ color: '#94A3B8', maxWidth: 520, margin: '0 auto 48px', fontSize: '0.95rem' }}>
          Authorized personnel only. Monitor energy distribution, review AI forecasts, and manage generator protocols.
        </p>
        <button
          onClick={() => setShowLogin(true)}
          className="btn-solid-cyan"
          style={{ fontSize: '1.05rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          Enter Dashboard
        </button>

        {/* Demo credentials hint */}
        <div style={{
          marginTop: 48,
          display: 'inline-block',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: '20px 32px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 14 }}>
            Demo Credentials
          </div>
          {DEMO_USERS.map(u => (
            <div key={u.label} style={{ display: 'flex', gap: 16, marginBottom: 6, fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: u.color, minWidth: 72, fontWeight: 600 }}>{u.label}</span>
              <span style={{ color: '#94A3B8' }}>{u.email}</span>
              <span style={{ color: '#475569' }}>/ {u.password}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{
        padding: '32px 60px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span style={{ fontFamily: 'Space Grotesk', color: '#06B6D4', fontWeight: 700, fontSize: '0.9rem' }}>
            POLARIS ENERGY AI
          </span>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#475569' }}>
          Ministry of Earth Sciences · NCPOR · SIH 2026 · All data simulated
        </div>
      </footer>
    </div>
  )
}
