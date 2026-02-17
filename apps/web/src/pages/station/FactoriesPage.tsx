import { useStation } from '../../features/station/useStation'
import {
  stationButtonClassName,
  stationFieldClassName,
  stationLabelClassName,
  stationSectionTitleClassName,
  stationSectionWrapperClassName,
} from './styles'

export function FactoriesPage() {
  const { selectedRecipeKey, setSelectedRecipeKey } = useStation()

  return (
    <section aria-label="Factories page" className={stationSectionWrapperClassName}>
      <h2 className={stationSectionTitleClassName}>Factories</h2>
      <label htmlFor="recipe-select" className={stationLabelClassName}>
        Recipe
      </label>
      <select
        id="recipe-select"
        value={selectedRecipeKey}
        onChange={(event) => setSelectedRecipeKey(event.target.value)}
        className={stationFieldClassName}
      >
        <option value="rcp_refine_metal_plates">rcp_refine_metal_plates</option>
        <option value="rcp_refine_wire_spools">rcp_refine_wire_spools</option>
        <option value="rcp_assemble_station_parts">rcp_assemble_station_parts</option>
      </select>
      <p>Selected recipe: {selectedRecipeKey}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={stationButtonClassName}>
          Select recipe
        </button>
        <button type="button" className={stationButtonClassName}>
          Clear recipe
        </button>
      </div>
    </section>
  )
}
