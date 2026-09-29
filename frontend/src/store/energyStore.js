import { create } from 'zustand'

const useEnergyStore = create((set) => ({
  currentReading: null,
  isLive: true,
  lastUpdate: null,
  scenario: 'normal',
  setCurrentReading: (reading) => set({ currentReading: reading, lastUpdate: new Date() }),
  setScenario: (scenario) => set({ scenario }),
  setIsLive: (isLive) => set({ isLive }),
}))

export default useEnergyStore
