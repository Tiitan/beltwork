import { Navigate, Route, Routes } from 'react-router-dom'
import { StationLayout } from '../components/station/StationLayout'
import { AccountSettingsPage } from './station/AccountSettingsPage'
import { BuildingsPage } from './station/BuildingsPage'
import { DashboardPage } from './station/DashboardPage'
import { FactoriesPage } from './station/FactoriesPage'
import { MapPage } from './station/MapPage'

/**
 * Renders station layout and station subpages.
 *
 * @returns Station route surface.
 */
export function StationPage() {
  return (
    <StationLayout>
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="buildings" element={<BuildingsPage />} />
        <Route path="factories" element={<FactoriesPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="account" element={<AccountSettingsPage />} />
        <Route path="*" element={<Navigate replace to="/station" />} />
      </Routes>
    </StationLayout>
  )
}
