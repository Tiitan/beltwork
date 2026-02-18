import { readFileSync } from 'node:fs'
import { z } from 'zod'

const startupResourceSchema = z.object({
  resource_key: z.string().trim().min(1),
  amount: z.number().int().nonnegative(),
})

const newStationConfigSchema = z.object({
  startup_resources: z.array(startupResourceSchema),
})

type StartupResource = z.infer<typeof startupResourceSchema>

function loadStartupResources(): StartupResource[] {
  const configFileUrl = new URL('../../../../gameconfig/new-station.json', import.meta.url)
  const configRaw = readFileSync(configFileUrl, 'utf8')
  const parsed = JSON.parse(configRaw) as unknown
  const config = newStationConfigSchema.parse(parsed)
  return config.startup_resources
}

export const startupResources = loadStartupResources()
