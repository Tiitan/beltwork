import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const buildingsCatalogSchema = z.object({
  buildings: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    }),
  ),
})

const resourcesCatalogSchema = z.object({
  resources: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    }),
  ),
})

let cachedBuildingNamesPromise: Promise<Map<string, string>> | null = null
let cachedResourceNamesPromise: Promise<Map<string, string>> | null = null

export async function loadBuildingNamesById(): Promise<Map<string, string>> {
  if (!cachedBuildingNamesPromise) {
    cachedBuildingNamesPromise = (async () => {
      const configFileUrl = new URL('../../../../gameconfig/buildings.json', import.meta.url)
      const raw = await readFile(configFileUrl, 'utf8')
      const parsed = buildingsCatalogSchema.parse(JSON.parse(raw) as unknown)
      return new Map(parsed.buildings.map((building) => [building.id, building.name]))
    })()
  }

  return cachedBuildingNamesPromise
}

export async function loadResourceNamesById(): Promise<Map<string, string>> {
  if (!cachedResourceNamesPromise) {
    cachedResourceNamesPromise = (async () => {
      const configFileUrl = new URL('../../../../gameconfig/resources.json', import.meta.url)
      const raw = await readFile(configFileUrl, 'utf8')
      const parsed = resourcesCatalogSchema.parse(JSON.parse(raw) as unknown)
      return new Map(parsed.resources.map((resource) => [resource.id, resource.name]))
    })()
  }

  return cachedResourceNamesPromise
}
