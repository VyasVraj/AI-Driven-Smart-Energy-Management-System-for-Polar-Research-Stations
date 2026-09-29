import { Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1A', color: '#E2E8F0' }}>
      <Outlet />
    </div>
  )
}
