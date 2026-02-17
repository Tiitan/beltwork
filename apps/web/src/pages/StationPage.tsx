import type { SubmitEvent } from 'react'
import type {
  AsteroidRow,
  BuildingRow,
  InventoryRow,
  SettingsForm,
  SessionType,
} from '../types/app'

type StationPageProps = {
  accountStatus: SessionType
  buildings: BuildingRow[]
  discoveredAsteroids: AsteroidRow[]
  displayName: string
  inventory: InventoryRow[]
  lastUpdatedAt: Date
  settingsForm: SettingsForm
  selectedAsteroid: AsteroidRow | undefined
  selectedAsteroidId: string
  selectedRecipeKey: string
  onDisconnect: () => void
  onRefreshStation: () => void
  onSaveSettings: (event: SubmitEvent<HTMLFormElement>) => void
  onSettingsDisplayNameChange: (value: string) => void
  onSettingsEmailChange: (value: string) => void
  onSettingsPasswordChange: (value: string) => void
  onSelectedAsteroidChange: (asteroidId: string) => void
  onSelectedRecipeChange: (recipeKey: string) => void
}

export function StationPage({
  accountStatus,
  buildings,
  discoveredAsteroids,
  displayName,
  inventory,
  lastUpdatedAt,
  settingsForm,
  selectedAsteroid,
  selectedAsteroidId,
  selectedRecipeKey,
  onDisconnect,
  onRefreshStation,
  onSaveSettings,
  onSettingsDisplayNameChange,
  onSettingsEmailChange,
  onSettingsPasswordChange,
  onSelectedAsteroidChange,
  onSelectedRecipeChange,
}: StationPageProps) {
  return (
    <section aria-label="Station page" className="screen station-screen">
      <header className="card station-header">
        <div>
          <p className="eyebrow">Station Console</p>
          <h1>Station</h1>
        </div>
        <div className="header-meta">
          <p>Commander: {displayName}</p>
          <p>Account: {accountStatus === 'local' ? 'activated' : 'guest'}</p>
          <p>Last updated at: {lastUpdatedAt.toISOString()}</p>
        </div>
        <div className="row-actions">
          <button type="button" onClick={onRefreshStation}>
            Refresh station
          </button>
          <button type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      </header>

      <div className="station-grid">
        <section aria-label="Station summary" className="card">
          <h2>Summary</h2>
          <p>Station id: st-0001</p>
          <p>Coordinates: x 140, y -25</p>
          <p>Status: operational</p>
        </section>

        <section aria-label="Inventory" className="card">
          <h2>Inventory</h2>
          <ul className="data-list">
            {inventory.map((item) => (
              <li key={item.resourceKey}>
                <span>{item.resourceKey}</span>
                <strong>{item.amount}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Buildings" className="card">
          <div className="section-head">
            <h2>Buildings</h2>
            <button type="button">Create building</button>
          </div>
          <ul className="data-list">
            {buildings.map((building) => (
              <li key={building.type}>
                <span>
                  {building.type} - level {building.level} - {building.status}
                </span>
                <button type="button">Upgrade</button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Mining" className="card">
          <h2>Mining</h2>
          <label htmlFor="asteroid-select">Target asteroid</label>
          <select
            id="asteroid-select"
            value={selectedAsteroidId}
            onChange={(event) => onSelectedAsteroidChange(event.target.value)}
          >
            {discoveredAsteroids.map((asteroid) => (
              <option key={asteroid.id} value={asteroid.id}>
                {asteroid.id} ({asteroid.templateId})
              </option>
            ))}
          </select>
          <p>Distance from station: {selectedAsteroid?.distanceFromStation ?? 0}</p>
          <p>Remaining units: {selectedAsteroid?.remainingUnits ?? 0}</p>
          <p>Depleted: {selectedAsteroid?.isDepleted ? 'yes' : 'no'}</p>
          <div className="row-actions">
            <button type="button">Start mining</button>
            <button type="button">Stop mining</button>
          </div>
        </section>

        <section aria-label="Factories" className="card">
          <h2>Factories</h2>
          <label htmlFor="recipe-select">Recipe</label>
          <select
            id="recipe-select"
            value={selectedRecipeKey}
            onChange={(event) => onSelectedRecipeChange(event.target.value)}
          >
            <option value="rcp_refine_metal_plates">rcp_refine_metal_plates</option>
            <option value="rcp_refine_wire_spools">rcp_refine_wire_spools</option>
            <option value="rcp_assemble_station_parts">rcp_assemble_station_parts</option>
          </select>
          <p>Selected recipe: {selectedRecipeKey}</p>
          <div className="row-actions">
            <button type="button">Select recipe</button>
            <button type="button">Clear recipe</button>
          </div>
        </section>

        <section aria-label="Account settings" className="card">
          <h2>Account settings</h2>
          <p>Set email, password, and display name.</p>
          <form onSubmit={onSaveSettings} className="stack-form">
            <label htmlFor="settings-display-name">Display name</label>
            <input
              id="settings-display-name"
              type="text"
              value={settingsForm.displayName}
              onChange={(event) => onSettingsDisplayNameChange(event.target.value)}
            />

            <label htmlFor="settings-email">Email</label>
            <input
              id="settings-email"
              type="email"
              value={settingsForm.email}
              onChange={(event) => onSettingsEmailChange(event.target.value)}
            />

            <label htmlFor="settings-password">Password</label>
            <input
              id="settings-password"
              type="password"
              value={settingsForm.password}
              onChange={(event) => onSettingsPasswordChange(event.target.value)}
            />

            <button type="submit">Save settings</button>
          </form>
        </section>
      </div>
    </section>
  )
}
