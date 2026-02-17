import { useContext } from 'react'
import { AuthSessionContext } from './AuthSessionProvider'

export function useAuthSession() {
  const context = useContext(AuthSessionContext)
  if (context === null) {
    throw new Error('useAuthSession must be used within AuthSessionProvider')
  }

  return context
}
