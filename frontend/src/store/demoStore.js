import { create } from 'zustand'

const useDemoStore = create((set) => ({
  isDemoMode: true,
  currentScenario: 'normal',
  demoStep: 0,
  scenarios: [
    { id: 'normal', name: 'Normal Operation', description: 'Station operating normally', icon: '🟢' },
    { id: 'high_demand', name: 'High Energy Demand', description: 'Demand spike detected', icon: '⚡' },
    { id: 'storm', name: 'Storm Conditions', description: 'Severe weather event', icon: '🌨️' },
    { id: 'polar_night', name: 'Polar Night', description: 'Zero solar generation', icon: '🌙' },
    { id: 'generator_failure', name: 'Generator Failure', description: 'Diesel generator offline', icon: '⚠️' },
    { id: 'low_fuel', name: 'Low Fuel', description: 'Fuel reserves critical', icon: '⛽' },
  ],
  setDemoMode: (isDemoMode) => set({ isDemoMode }),
  setScenario: (scenario) => set({ currentScenario: scenario }),
  nextStep: () => set(state => ({ demoStep: Math.min(state.demoStep + 1, 8) })),
  prevStep: () => set(state => ({ demoStep: Math.max(state.demoStep - 1, 0) })),
  resetDemo: () => set({ demoStep: 0, currentScenario: 'normal' }),
}))

export default useDemoStore
