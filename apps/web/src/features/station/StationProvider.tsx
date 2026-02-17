import type { ReactNode } from 'react'
import { createContext } from 'react'
import { useStationState } from '../../hooks/useStationState'

export const StationContext = createContext<ReturnType<typeof useStationState> | null>(null)

type StationProviderProps = {
  children: ReactNode
}

export function StationProvider({ children }: StationProviderProps) {
  const stationState = useStationState()
  return <StationContext.Provider value={stationState}>{children}</StationContext.Provider>
}
