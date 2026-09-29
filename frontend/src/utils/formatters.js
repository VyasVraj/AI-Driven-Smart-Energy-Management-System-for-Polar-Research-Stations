export const formatKW = (value) => {
  if (value === null || value === undefined) return 'N/A'
  if (value >= 1000) return `${(value/1000).toFixed(1)} MW`
  return `${Math.round(value)} kW`
}

export const formatPct = (value, decimals = 1) => {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(decimals)}%`
}

export const formatLiters = (value) => {
  if (value === null || value === undefined) return 'N/A'
  if (value >= 1000) return `${(value/1000).toFixed(1)}k L`
  return `${Math.round(value)} L`
}

export const formatTemp = (value) => {
  if (value === null || value === undefined) return 'N/A'
  return `${value.toFixed(1)}°C`
}

export const formatTime = (date) => {
  return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(date))
}

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

export const formatDateTime = (date) => `${formatDate(date)} ${formatTime(date)}`

export const getRiskColor = (level) => ({
  'LOW': 'text-emerald-400',
  'MEDIUM': 'text-yellow-400',
  'HIGH': 'text-amber-500',
  'CRITICAL': 'text-red-500',
}[level] || 'text-slate-400')

export const getRiskBg = (level) => ({
  'LOW': 'bg-emerald-500/10 border-emerald-500/30',
  'MEDIUM': 'bg-yellow-500/10 border-yellow-500/30',
  'HIGH': 'bg-amber-500/10 border-amber-500/30',
  'CRITICAL': 'bg-red-500/10 border-red-500/30',
}[level] || 'bg-slate-800 border-slate-700')

export const getSeverityColor = (severity) => ({
  'INFO': 'text-blue-400',
  'WARNING': 'text-yellow-400',
  'HIGH': 'text-amber-500',
  'CRITICAL': 'text-red-500',
}[severity] || 'text-slate-400')
