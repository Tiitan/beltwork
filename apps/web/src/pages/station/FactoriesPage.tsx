import { useStation } from '../../features/station/useStation'
import { getRecipeIconPath, iconFallbackPaths } from '../../features/station/iconPaths'
import {
  stationButtonClassName,
  stationFieldClassName,
  stationLabelClassName,
  stationSectionTitleClassName,
  stationSectionWrapperClassName,
} from './styles'

const availableRecipes = [
  'rcp_refine_metal_plates',
  'rcp_refine_wire_spools',
  'rcp_assemble_station_parts',
]

export function FactoriesPage() {
  const { selectedRecipeKey, setSelectedRecipeKey } = useStation()

  return (
    <section aria-label="Factories page" className={stationSectionWrapperClassName}>
      <h2 className={stationSectionTitleClassName}>Factories</h2>
      <div className="mb-1 flex items-center gap-2">
        <img
          src={getRecipeIconPath(selectedRecipeKey)}
          alt={`${selectedRecipeKey} recipe icon`}
          className="h-32 w-32 rounded-sm object-cover"
          onError={(event) => {
            event.currentTarget.src = iconFallbackPaths.recipe
          }}
        />
        <p className="m-0 text-sm text-slate-300">Selected recipe: {selectedRecipeKey}</p>
      </div>
      <label htmlFor="recipe-select" className={stationLabelClassName}>
        Recipe
      </label>
      <select
        id="recipe-select"
        value={selectedRecipeKey}
        onChange={(event) => setSelectedRecipeKey(event.target.value)}
        className={stationFieldClassName}
      >
        {availableRecipes.map((recipeKey) => (
          <option key={recipeKey} value={recipeKey}>
            {recipeKey}
          </option>
        ))}
      </select>
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
