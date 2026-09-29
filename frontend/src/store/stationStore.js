import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStationStore = create(persist(
  (set) => ({
    stations: [],
    currentStation: null,
    currentStationId: 1,
    setStations: (stations) => set({ stations }),
    setCurrentStation: (station) => set({ currentStation: station, currentStationId: station.id }),
    setCurrentStationId: (id) => set({ currentStationId: id }),
  }),
  { name: 'polaris-station' }
))

export default useStationStore
