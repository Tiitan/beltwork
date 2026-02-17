import { useContext } from 'react'
import { StationContext } from './StationProvider'

export function useStation() {
  const context = useContext(StationContext)
  if (context === null) {
    throw new Error('useStation must be used within StationProvider')
  }

  return context
}
