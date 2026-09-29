import { create } from 'zustand'

const useAlertStore = create((set, get) => ({
  alerts: [],
  unreadCount: 0,
  setAlerts: (alerts) => set({ alerts, unreadCount: alerts.filter(a => !a.is_acknowledged).length }),
  addAlert: (alert) => set(state => ({ alerts: [alert, ...state.alerts], unreadCount: state.unreadCount + 1 })),
  acknowledge: (id) => set(state => ({
    alerts: state.alerts.map(a => a.id === id ? { ...a, is_acknowledged: true } : a),
    unreadCount: Math.max(0, state.unreadCount - 1)
  }))
}))

export default useAlertStore
