import { useStation } from '../../features/station/useStation'
import { getBlueprintIconPath, iconFallbackPaths } from '../../features/station/iconPaths'
import {
  stationButtonClassName,
  stationFieldClassName,
  stationLabelClassName,
  stationSectionTitleClassName,
  stationSectionWrapperClassName,
} from './styles'

const availableBlueprints = [
  'bp_refine_metal_plates',
  'bp_refine_wire_spools',
  'bp_assemble_station_parts',
]

export function FactoriesPage() {
  const { selectedBlueprintKey, setSelectedBlueprintKey } = useStation()

  return (
    <section aria-label="Factories page" className={stationSectionWrapperClassName}>
      <h2 className={stationSectionTitleClassName}>Factories</h2>
      <div className="mb-1 flex items-center gap-2">
        <img
          src={getBlueprintIconPath(selectedBlueprintKey)}
          alt={`${selectedBlueprintKey} blueprint icon`}
          className="h-32 w-32 rounded-sm object-cover"
          onError={(event) => {
            event.currentTarget.src = iconFallbackPaths.blueprint
          }}
        />
        <p className="m-0 text-sm text-slate-300">Selected blueprint: {selectedBlueprintKey}</p>
      </div>
      <label htmlFor="blueprint-select" className={stationLabelClassName}>
        Blueprint
      </label>
      <select
        id="blueprint-select"
        value={selectedBlueprintKey}
        onChange={(event) => setSelectedBlueprintKey(event.target.value)}
        className={stationFieldClassName}
      >
        {availableBlueprints.map((blueprintKey) => (
          <option key={blueprintKey} value={blueprintKey}>
            {blueprintKey}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={stationButtonClassName}>
          Select blueprint
        </button>
        <button type="button" className={stationButtonClassName}>
          Clear blueprint
        </button>
      </div>
    </section>
  )
}
