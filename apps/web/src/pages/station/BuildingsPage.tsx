import { useStation } from '../../features/station/useStation'
import { getBuildingIconPath, iconFallbackPaths } from '../../features/station/iconPaths'
import {
  stationButtonClassName,
  stationSectionTitleClassName,
  stationSectionWrapperClassName,
} from './styles'

export function BuildingsPage() {
  const { buildings } = useStation()

  return (
    <section aria-label="Buildings page" className={stationSectionWrapperClassName}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={stationSectionTitleClassName}>Buildings</h2>
        <button type="button" className={stationButtonClassName}>
          Create building
        </button>
      </div>
      <ul className="m-0 grid list-none gap-2 p-0">
        {buildings.map((building) => (
          <li
            key={building.type}
            className="flex flex-col items-start justify-between gap-2 border-b border-slate-400/20 pb-1 sm:flex-row sm:items-center"
          >
            <span className="flex min-w-0 items-center gap-2 break-words">
              <img
                src={getBuildingIconPath(building.type)}
                alt={`${building.type} building icon`}
                className="h-32 w-32 rounded-sm object-cover"
                onError={(event) => {
                  event.currentTarget.src = iconFallbackPaths.building
                }}
              />
              <span className="min-w-0 break-words">
                {building.type} - level {building.level} - {building.status}
              </span>
            </span>
            <button type="button" className={`${stationButtonClassName} shrink-0`}>
              Upgrade
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
