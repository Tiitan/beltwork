import { useStation } from '../../features/station/useStation'
import { getAsteroidIconPath, iconFallbackPaths } from '../../features/station/iconPaths'
import {
  stationButtonClassName,
  stationFieldClassName,
  stationLabelClassName,
  stationListRowClassName,
  stationSectionTitleClassName,
  stationSectionWrapperClassName,
} from './styles'

export function MapPage() {
  const { discoveredAsteroids, selectedAsteroid, selectedAsteroidId, setSelectedAsteroidId } =
    useStation()

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section aria-label="Map page mining" className={stationSectionWrapperClassName}>
        <h2 className={stationSectionTitleClassName}>Mining</h2>
        {selectedAsteroid ? (
          <div className="mb-1 flex items-center gap-2">
            <img
              src={getAsteroidIconPath(selectedAsteroid.templateId)}
              alt={`${selectedAsteroid.templateId} asteroid icon`}
              className="h-32 w-32 rounded-sm object-cover"
              onError={(event) => {
                event.currentTarget.src = iconFallbackPaths.asteroid
              }}
            />
            <p className="m-0 text-sm text-slate-300">{selectedAsteroid.templateId}</p>
          </div>
        ) : null}
        <label htmlFor="asteroid-select" className={stationLabelClassName}>
          Target asteroid
        </label>
        <select
          id="asteroid-select"
          value={selectedAsteroidId}
          onChange={(event) => setSelectedAsteroidId(event.target.value)}
          className={stationFieldClassName}
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
          <button type="button" className={stationButtonClassName}>
            Start mining
          </button>
          <button type="button" className={stationButtonClassName}>
            Stop mining
          </button>
        </div>
      </section>

      <section aria-label="Map page scan" className={stationSectionWrapperClassName}>
        <h2 className={stationSectionTitleClassName}>Scan</h2>
        <p>Known asteroids: {discoveredAsteroids.length}</p>
        <p>Last scanned sector: x 140, y -25</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={stationButtonClassName}>
            Run scan
          </button>
        </div>
        <ul className="m-0 grid list-none gap-2 p-0">
          {discoveredAsteroids.map((asteroid) => (
            <li key={asteroid.id} className={stationListRowClassName}>
              <span className="flex min-w-0 items-center gap-2 break-words">
                <img
                  src={getAsteroidIconPath(asteroid.templateId)}
                  alt={`${asteroid.templateId} asteroid icon`}
                  className="h-32 w-32 rounded-sm object-cover"
                  onError={(event) => {
                    event.currentTarget.src = iconFallbackPaths.asteroid
                  }}
                />
                <span className="min-w-0 break-words">{asteroid.id}</span>
              </span>
              <span>{asteroid.templateId}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
