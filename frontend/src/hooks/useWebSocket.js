import { useEffect, useRef, useCallback } from 'react'
import useEnergyStore from '../store/energyStore'
import useAlertStore from '../store/alertStore'
import useStationStore from '../store/stationStore'

export function useWebSocket() {
  const ws = useRef(null)
  const reconnectTimer = useRef(null)
  const reconnectDelay = useRef(1000)
  const { setCurrentReading } = useEnergyStore()
  const { addAlert } = useAlertStore()
  const { currentStationId } = useStationStore()

  const connect = useCallback(() => {
    const wsUrl = `ws://localhost:8000/ws/energy/${currentStationId || 1}`
    ws.current = new WebSocket(wsUrl)

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'energy_update') setCurrentReading(data.data)
        if (data.type === 'alert') addAlert(data.data)
      } catch (e) { console.error('WS parse error:', e) }
    }

    ws.current.onclose = () => {
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
        connect()
      }, reconnectDelay.current)
    }

    ws.current.onopen = () => { reconnectDelay.current = 1000 }
  }, [currentStationId, setCurrentReading, addAlert])

  useEffect(() => {
    connect()
    return () => {
      if (ws.current) ws.current.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  return ws
}
