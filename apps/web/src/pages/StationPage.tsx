import type { SubmitEvent } from 'react'
import type {
  AsteroidRow,
  BuildingRow,
  InventoryRow,
  SettingsForm,
  SessionType,
} from '../types/app'

/**
 * Input contract for station screen rendering and interactions.
 */
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

/**
 * Renders the station operations and account settings dashboard.
 *
 * @param props Station read model plus callback handlers for user actions.
 * @returns Station page UI.
 */
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
  const cardClassName =
    'overflow-hidden rounded-2xl border border-slate-300/30 bg-slate-900/45 shadow-xl backdrop-blur-md'
  const sectionTitleClassName = 'mb-3 text-lg text-sky-100'
  const labelClassName = 'text-sm text-slate-300'
  const fieldClassName =
    'mb-1 rounded-md border border-slate-400/45 bg-slate-950/60 px-3 py-2 text-slate-100'
  const buttonClassName =
    'cursor-pointer rounded-md border border-teal-300/70 bg-gradient-to-br from-teal-500 to-cyan-700 px-3 py-2 text-teal-50 transition hover:brightness-110'

  return (
    <section aria-label="Station page" className="mx-auto w-full max-w-6xl pb-5 pt-4">
      <header className={`${cardClassName} mb-4 grid min-w-0 gap-3 p-4`}>
        <div>
          <p className="mb-1 text-xs uppercase tracking-widest text-sky-200">Station Console</p>
          <h1 className="text-3xl tracking-tight md:text-4xl">Station</h1>
        </div>
        <div className="grid gap-1 text-slate-300">
          <p>Commander: {displayName}</p>
          <p>Account: {accountStatus === 'local' ? 'activated' : 'guest'}</p>
          <p>Last updated at: {lastUpdatedAt.toISOString()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefreshStation} className={buttonClassName}>
            Refresh station
          </button>
          <button type="button" onClick={onDisconnect} className={buttonClassName}>
            Disconnect
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <section aria-label="Station summary" className={`${cardClassName} grid min-w-0 gap-2 p-4`}>
          <h2 className={sectionTitleClassName}>Summary</h2>
          <p>Station id: st-0001</p>
          <p>Coordinates: x 140, y -25</p>
          <p>Status: operational</p>
        </section>

        <section aria-label="Inventory" className={`${cardClassName} grid min-w-0 gap-2 p-4`}>
          <h2 className={sectionTitleClassName}>Inventory</h2>
          <ul className="m-0 grid list-none gap-2 p-0">
            {inventory.map((item) => (
              <li
                key={item.resourceKey}
                className="flex items-center justify-between gap-3 border-b border-slate-400/20 pb-1"
              >
                <span className="min-w-0 break-words">{item.resourceKey}</span>
                <strong>{item.amount}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Buildings" className={`${cardClassName} grid min-w-0 gap-2 p-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={sectionTitleClassName}>Buildings</h2>
            <button type="button" className={buttonClassName}>
              Create building
            </button>
          </div>
          <ul className="m-0 grid list-none gap-2 p-0">
            {buildings.map((building) => (
              <li
                key={building.type}
                className="flex flex-col items-start justify-between gap-2 border-b border-slate-400/20 pb-1 sm:flex-row sm:items-center"
              >
                <span className="min-w-0 break-words">
                  {building.type} - level {building.level} - {building.status}
                </span>
                <button type="button" className={`${buttonClassName} shrink-0`}>
                  Upgrade
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Mining" className={`${cardClassName} grid min-w-0 gap-2 p-4`}>
          <h2 className={sectionTitleClassName}>Mining</h2>
          <label htmlFor="asteroid-select" className={labelClassName}>
            Target asteroid
          </label>
          <select
            id="asteroid-select"
            value={selectedAsteroidId}
            onChange={(event) => onSelectedAsteroidChange(event.target.value)}
            className={fieldClassName}
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
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClassName}>
              Start mining
            </button>
            <button type="button" className={buttonClassName}>
              Stop mining
            </button>
          </div>
        </section>

        <section aria-label="Factories" className={`${cardClassName} grid min-w-0 gap-2 p-4`}>
          <h2 className={sectionTitleClassName}>Factories</h2>
          <label htmlFor="recipe-select" className={labelClassName}>
            Recipe
          </label>
          <select
            id="recipe-select"
            value={selectedRecipeKey}
            onChange={(event) => onSelectedRecipeChange(event.target.value)}
            className={fieldClassName}
          >
            <option value="rcp_refine_metal_plates">rcp_refine_metal_plates</option>
            <option value="rcp_refine_wire_spools">rcp_refine_wire_spools</option>
            <option value="rcp_assemble_station_parts">rcp_assemble_station_parts</option>
          </select>
          <p>Selected recipe: {selectedRecipeKey}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClassName}>
              Select recipe
            </button>
            <button type="button" className={buttonClassName}>
              Clear recipe
            </button>
          </div>
        </section>

        <section
          aria-label="Account settings"
          className={`${cardClassName} grid min-w-0 gap-2 p-4`}
        >
          <h2 className={sectionTitleClassName}>Account settings</h2>
          <p>Set email, password, and display name.</p>
          <form onSubmit={onSaveSettings} className="grid gap-2">
            <label htmlFor="settings-display-name" className={labelClassName}>
              Display name
            </label>
            <input
              id="settings-display-name"
              type="text"
              value={settingsForm.displayName}
              onChange={(event) => onSettingsDisplayNameChange(event.target.value)}
              className={fieldClassName}
            />

            <label htmlFor="settings-email" className={labelClassName}>
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={settingsForm.email}
              onChange={(event) => onSettingsEmailChange(event.target.value)}
              className={fieldClassName}
            />

            <label htmlFor="settings-password" className={labelClassName}>
              Password
            </label>
            <input
              id="settings-password"
              type="password"
              value={settingsForm.password}
              onChange={(event) => onSettingsPasswordChange(event.target.value)}
              className={fieldClassName}
            />

            <button type="submit" className={buttonClassName}>
              Save settings
            </button>
          </form>
        </section>
      </div>
    </section>
  )
}
