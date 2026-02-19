const resourceIconBasePath = '/assets/icons/ressources'
const buildingIconBasePath = '/assets/icons/buildings'
const blueprintIconBasePath = '/assets/icons/blueprints'
const asteroidIconBasePath = '/assets/icons/asteroids'
const stationIconBasePath = '/assets/icons/stations'

const resourceFallbackIconPath = `${resourceIconBasePath}/res_metals.png`
const buildingFallbackIconPath = `${buildingIconBasePath}/bld_refinery.png`
const blueprintFallbackIconPath = `${blueprintIconBasePath}/bp_refine_metal_plates.png`
const asteroidFallbackIconPath = `${asteroidIconBasePath}/ast_common_chondrite.png`
const defaultAsteroidIconPath = `${asteroidIconBasePath}/ast_default.png`
const stationFallbackIconPath = `${stationIconBasePath}/default_station.png`

const resourceIconKeyByResourceKey: Record<string, string> = {
  water: 'res_water',
  metals: 'res_metals',
  conductors: 'res_conductors',
  carbon_materials: 'res_carbon',
  metal_plates: 'cmp_metal_plates',
  wire_spools: 'cmp_wire_spools',
  polymer_parts: 'cmp_polymer_parts',
  coolant_cells: 'cmp_coolant_cells',
  rig_kits: 'adv_rig_kits',
  station_parts: 'adv_station_parts',
}

export function getResourceIconPath(resourceKey: string) {
  const iconKey = resourceIconKeyByResourceKey[resourceKey] ?? resourceKey
  return `${resourceIconBasePath}/${iconKey}.png`
}

export function getBuildingIconPath(buildingType: string) {
  return `${buildingIconBasePath}/bld_${buildingType}.png`
}

export function getBlueprintIconPath(blueprintKey: string) {
  return `${blueprintIconBasePath}/${blueprintKey}.png`
}

export function getAsteroidIconPath(asteroidTemplateId: string) {
  return `${asteroidIconBasePath}/${asteroidTemplateId}.png`
}

export function getDefaultAsteroidIconPath() {
  return defaultAsteroidIconPath
}

export function getStationIconPath() {
  return stationFallbackIconPath
}

export const iconFallbackPaths = {
  resource: resourceFallbackIconPath,
  building: buildingFallbackIconPath,
  blueprint: blueprintFallbackIconPath,
  asteroid: asteroidFallbackIconPath,
  station: stationFallbackIconPath,
}
