import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useWebSocket } from '../../hooks/useWebSocket'
import DemoModePanel from '../demo/DemoModePanel'
import useDemoStore from '../../store/demoStore'

export default function MainLayout() {
  useWebSocket()
  const { isDemoMode } = useDemoStore()

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0A0F1A',
      overflow: 'hidden',
      color: '#E2E8F0',
      position: 'relative',
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <TopBar />
        {isDemoMode && <DemoModePanel />}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px',
          background: '#0A0F1A',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
