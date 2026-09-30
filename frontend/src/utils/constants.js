export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export const SEVERITY_LEVELS = ['INFO', 'WARNING', 'HIGH', 'CRITICAL']
export const USER_ROLES = ['ADMIN', 'STATION_OPERATOR', 'RESEARCHER', 'VIEWER']

export const ENERGY_SOURCES = {
  SOLAR: { name: 'Solar', color: '#F59E0B', icon: '☀️' },
  WIND: { name: 'Wind', color: '#00B4D8', icon: '🌬️' },
  BATTERY: { name: 'Battery', color: '#52B788', icon: '🔋' },
  DIESEL: { name: 'Diesel', color: '#6B7280', icon: '⚙️' },
}

export const DEMO_SCENARIOS = [
  'normal', 'high_demand', 'storm', 'polar_night',
  'generator_failure', 'low_fuel', 'low_battery', 'extreme_cold'
]

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Command Center', icon: 'LayoutDashboard', group: 'Main' },
  { path: '/stations', label: 'Stations', icon: 'MapPin', group: 'Main' },
  { path: '/energy', label: 'Energy Monitoring', icon: 'Zap', group: 'Energy Intelligence' },
  { path: '/forecasting/load', label: 'Load Forecasting', icon: 'TrendingUp', group: 'Energy Intelligence' },
  { path: '/forecasting/renewable', label: 'Renewable Forecast', icon: 'Sun', group: 'Energy Intelligence' },
  { path: '/optimization', label: 'Optimization', icon: 'Target', group: 'Energy Intelligence' },
  { path: '/battery', label: 'Battery', icon: 'Battery', group: 'Assets' },
  { path: '/fuel', label: 'Fuel', icon: 'Fuel', group: 'Assets' },
  { path: '/weather', label: 'Weather', icon: 'Cloud', group: 'Assets' },
  { path: '/risk', label: 'Risk Center', icon: 'ShieldAlert', group: 'Intelligence' },
  { path: '/anomalies', label: 'Anomalies', icon: 'AlertTriangle', group: 'Intelligence' },
  { path: '/simulator', label: 'What-If Simulator', icon: 'FlaskConical', group: 'Intelligence' },
  { path: '/digital-twin', label: 'Digital Twin', icon: 'Cpu', group: 'Intelligence' },
  { path: '/advisor', label: 'AI Advisor (RAG)', icon: 'BrainCircuit', group: 'AI' },
  // SIH Upgrades
  { path: '/mpc-optimizer', label: 'MPC Optimizer', icon: 'Cpu', group: 'AI' },
  { path: '/load-shedding', label: 'Load Shedding', icon: 'ShieldAlert', group: 'AI' },
  { path: '/reports', label: 'Reports', icon: 'FileText', group: 'Analytics' },
  { path: '/analytics', label: 'Analytics', icon: 'BarChart3', group: 'Analytics' },
  { path: '/alerts', label: 'Alerts', icon: 'Bell', group: 'Monitoring' },
  { path: '/settings', label: 'Settings', icon: 'Settings', group: 'System' },
  { path: '/admin', label: 'Admin', icon: 'Users', group: 'System' },
]
