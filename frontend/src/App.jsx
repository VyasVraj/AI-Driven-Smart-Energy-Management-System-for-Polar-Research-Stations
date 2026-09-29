import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import MainLayout from './components/layout/MainLayout'
import AuthLayout from './components/layout/AuthLayout'
import useAuthStore from './store/authStore'

// Fallback spinner
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen bg-slate-950">
    <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
)

// Lazy load all pages
const Login = lazy(() => import('./pages/Login'))
const CommandCenter = lazy(() => import('./pages/CommandCenter'))
const StationOverview = lazy(() => import('./pages/StationOverview'))
const EnergyMonitoring = lazy(() => import('./pages/EnergyMonitoring'))
const LoadForecasting = lazy(() => import('./pages/LoadForecasting'))
const RenewableForecasting = lazy(() => import('./pages/RenewableForecasting'))
const EnergyOptimization = lazy(() => import('./pages/EnergyOptimization'))
const BatteryManagement = lazy(() => import('./pages/BatteryManagement'))
const FuelManagement = lazy(() => import('./pages/FuelManagement'))
const WeatherIntelligence = lazy(() => import('./pages/WeatherIntelligence'))
const RiskCenter = lazy(() => import('./pages/RiskCenter'))
const AnomalyDetection = lazy(() => import('./pages/AnomalyDetection'))
const WhatIfSimulator = lazy(() => import('./pages/WhatIfSimulator'))
const DigitalTwin = lazy(() => import('./pages/DigitalTwin'))
const AIAdvisor = lazy(() => import('./pages/AIAdvisor'))
const Reports = lazy(() => import('./pages/Reports'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Settings = lazy(() => import('./pages/Settings'))
const AdminPanel = lazy(() => import('./pages/AdminPanel'))

function ProtectedRoute({ children }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
        </Route>
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<CommandCenter />} />
          <Route path="/stations" element={<StationOverview />} />
          <Route path="/energy" element={<EnergyMonitoring />} />
          <Route path="/forecasting/load" element={<LoadForecasting />} />
          <Route path="/forecasting/renewable" element={<RenewableForecasting />} />
          <Route path="/optimization" element={<EnergyOptimization />} />
          <Route path="/battery" element={<BatteryManagement />} />
          <Route path="/fuel" element={<FuelManagement />} />
          <Route path="/weather" element={<WeatherIntelligence />} />
          <Route path="/risk" element={<RiskCenter />} />
          <Route path="/anomalies" element={<AnomalyDetection />} />
          <Route path="/simulator" element={<WhatIfSimulator />} />
          <Route path="/digital-twin" element={<DigitalTwin />} />
          <Route path="/advisor" element={<AIAdvisor />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
