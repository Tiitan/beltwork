#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs as parseNodeArgs } from 'node:util'
import { createComfyUIProvider } from './image-providers/comfyui.mjs'
import { createOpenAIProvider } from './image-providers/openai.mjs'

const NEGATIVE_PROMPT =
  'photorealistic, horror, weapon focus, violence, blood, text, watermark, logo, low contrast, blurry, noisy background, cluttered composition'

const CONFIG_FILES = [
  ['gameconfig/resources.json', 'resources', 'ressources'],
  ['gameconfig/buildings.json', 'buildings', 'buildings'],
  ['gameconfig/recipes.json', 'recipes', 'recipes'],
  ['gameconfig/asteroids.json', 'asteroid_templates', 'asteroids'],
]

function parseArgs(argv) {
  const defaults = {
    provider: process.env.ASSET_IMAGE_PROVIDER || 'comfyui',
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    size: process.env.IMAGE_SIZE || process.env.OPENAI_IMAGE_SIZE || '1024x1024',
    outDir: path.resolve('apps/web/public/assets/icons'),
    background: process.env.OPENAI_IMAGE_BACKGROUND || null,
    comfyUrl: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
    comfyCheckpoint: process.env.COMFYUI_CHECKPOINT || '',
    comfySteps: 28,
    comfyCfg: 7,
    comfySampler: 'euler',
    comfyScheduler: 'normal',
    comfyDenoise: 1,
    comfyPollMs: 1200,
    comfyTimeoutMs: 120000,
    dryRun: false,
    rebuildAll: false,
    only: null,
    limit: null,
  }

  const { values } = parseNodeArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      'dry-run': { type: 'boolean' },
      provider: { type: 'string' },
      model: { type: 'string' },
      size: { type: 'string' },
      'out-dir': { type: 'string' },
      background: { type: 'string' },
      'comfy-url': { type: 'string' },
      'comfy-checkpoint': { type: 'string' },
      'comfy-steps': { type: 'string' },
      'comfy-cfg': { type: 'string' },
      'comfy-sampler': { type: 'string' },
      'comfy-scheduler': { type: 'string' },
      'comfy-denoise': { type: 'string' },
      'comfy-poll-ms': { type: 'string' },
      'comfy-timeout-ms': { type: 'string' },
      'rebuild-all': { type: 'boolean' },
      only: { type: 'string' },
      limit: { type: 'string' },
      help: { type: 'boolean' },
    },
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  let only = null
  if (values.only) {
    only = new Set(
      values.only
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
  }

  let limit = null
  if (values.limit !== undefined) {
    const parsed = Number.parseInt(values.limit, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      limit = parsed
    }
  }

  const parseNumber = (value, fallback) => {
    if (value === undefined) {
      return fallback
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return {
    provider: (values.provider ?? defaults.provider).toLowerCase(),
    model: values.model ?? defaults.model,
    size: values.size ?? defaults.size,
    outDir: values['out-dir'] ? path.resolve(values['out-dir']) : defaults.outDir,
    background: values.background ?? defaults.background,
    comfyUrl: values['comfy-url'] ?? defaults.comfyUrl,
    comfyCheckpoint: values['comfy-checkpoint'] ?? defaults.comfyCheckpoint,
    comfySteps: parseNumber(values['comfy-steps'], defaults.comfySteps),
    comfyCfg: parseNumber(values['comfy-cfg'], defaults.comfyCfg),
    comfySampler: values['comfy-sampler'] ?? defaults.comfySampler,
    comfyScheduler: values['comfy-scheduler'] ?? defaults.comfyScheduler,
    comfyDenoise: parseNumber(values['comfy-denoise'], defaults.comfyDenoise),
    comfyPollMs: parseNumber(values['comfy-poll-ms'], defaults.comfyPollMs),
    comfyTimeoutMs: parseNumber(values['comfy-timeout-ms'], defaults.comfyTimeoutMs),
    dryRun: values['dry-run'] ?? defaults.dryRun,
    rebuildAll: values['rebuild-all'] ?? defaults.rebuildAll,
    only,
    limit,
  }
}

function printHelp() {
  console.log('Usage: npm run assets:generate -- -- [options]')
  console.log('')
  console.log('Options:')
  console.log('  --dry-run                   Print plan without generating images')
  console.log('  --provider <name>           Provider: comfyui (default) or openai')
  console.log('  --model <name>              Image model (default: gpt-image-1)')
  console.log('  --size <WxH>                Output image size (default: 1024x1024)')
  console.log('  --background <mode>         Background override (transparent or opaque)')
  console.log('  --comfy-url <url>           ComfyUI endpoint (default: http://127.0.0.1:8188)')
  console.log('  --comfy-checkpoint <name>   ComfyUI checkpoint name (required for comfyui)')
  console.log('  --comfy-steps <n>           ComfyUI sampler steps (default: 28)')
  console.log('  --comfy-cfg <n>             ComfyUI cfg scale (default: 7)')
  console.log('  --comfy-sampler <name>      ComfyUI sampler (default: euler)')
  console.log('  --comfy-scheduler <name>    ComfyUI scheduler (default: normal)')
  console.log('  --comfy-denoise <n>         ComfyUI denoise strength (default: 1)')
  console.log('  --comfy-poll-ms <n>         ComfyUI poll interval ms (default: 1200)')
  console.log('  --comfy-timeout-ms <n>      ComfyUI timeout ms (default: 120000)')
  console.log('  --rebuild-all               Regenerate all icons, including existing files')
  console.log('  --out-dir <path>            Output directory')
  console.log('  --only <id,id,...>          Generate only specific icon ids')
  console.log('  --limit <n>                 Generate only first n icons')
  console.log('  --help                      Show this help text')
}

async function loadIconSpecsFromConfig() {
  const specs = []

  for (const [filePath, arrayKey, folder] of CONFIG_FILES) {
    const raw = await fs.readFile(filePath, 'utf8')
    const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
    const json = JSON.parse(sanitized)
    const list = json[arrayKey]
    const familyMasterPrompt = json.icon_master_prompt
    const familyOutputBackground = json.icon_output_background ?? null

    if (!Array.isArray(list)) {
      throw new Error(`Expected array at ${filePath} -> ${arrayKey}`)
    }
    if (!familyMasterPrompt) {
      throw new Error(`Missing icon_master_prompt in ${filePath}.`)
    }

    for (const entry of list) {
      if (!entry?.icon) {
        continue
      }

      if (!entry.icon_visual_description) {
        throw new Error(`Missing icon_visual_description for ${entry.icon} in ${filePath}.`)
      }

      specs.push({
        id: entry.icon,
        description: entry.icon_visual_description,
        folder,
        masterPrompt: familyMasterPrompt,
        outputBackground: familyOutputBackground,
      })
    }
  }

  const byId = new Map()
  for (const spec of specs) {
    if (!byId.has(spec.id)) {
      byId.set(spec.id, {
        description: spec.description,
        folder: spec.folder,
        masterPrompt: spec.masterPrompt,
        outputBackground: spec.outputBackground,
      })
      continue
    }

    const existing = byId.get(spec.id)
    if (existing.description !== spec.description) {
      throw new Error(`Conflicting icon_visual_description values for ${spec.id}.`)
    }

    if (existing.folder !== spec.folder) {
      throw new Error(`Conflicting folder values for ${spec.id}.`)
    }
    if (existing.masterPrompt !== spec.masterPrompt) {
      throw new Error(`Conflicting icon_master_prompt values for ${spec.id}.`)
    }
    if (existing.outputBackground !== spec.outputBackground) {
      throw new Error(`Conflicting icon_output_background values for ${spec.id}.`)
    }
  }

  return [...byId.entries()].map(([id, value]) => ({
    id,
    description: value.description,
    folder: value.folder,
    masterPrompt: value.masterPrompt,
    outputBackground: value.outputBackground,
  }))
}

function buildPrompt(masterPrompt, description) {
  return `${masterPrompt} Asset focus: ${description}`
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const provider = createProvider(opts)

  const iconSpecs = await loadIconSpecsFromConfig()
  let selected = iconSpecs
  if (opts.only) {
    selected = selected.filter((spec) => opts.only.has(spec.id))
  }
  if (opts.limit) {
    selected = selected.slice(0, opts.limit)
  }

  if (selected.length === 0) {
    console.log('No icon ids selected. Nothing to generate.')
    return
  }

  await fs.mkdir(opts.outDir, { recursive: true })

  const planned = []
  let skippedExisting = 0
  for (const spec of selected) {
    const outputDir = path.join(opts.outDir, spec.folder)
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, `${spec.id}.png`)
    const exists = await fileExists(outputPath)
    if (!opts.rebuildAll && exists) {
      skippedExisting += 1
      continue
    }
    planned.push({ ...spec, outputPath })
  }

  console.log(`Output dir: ${opts.outDir}`)
  console.log(`Provider: ${provider.name}`)
  console.log(`Model: ${opts.model}`)
  console.log(`Size: ${opts.size}`)
  console.log(`Background: ${opts.background ?? 'family-config'}`)
  console.log(`Selected icons: ${selected.length}`)
  console.log(`Existing skipped: ${skippedExisting}`)
  console.log(`To generate: ${planned.length}`)

  if (opts.dryRun) {
    for (const spec of planned) {
      console.log(`[dry-run] generate ${spec.id}.png`)
    }
    if (!opts.rebuildAll && skippedExisting > 0) {
      console.log('[dry-run] existing files would be skipped')
    }
    return
  }

  if (planned.length === 0) {
    console.log('Nothing to generate. Use --rebuild-all to regenerate existing icons.')
    return
  }

  for (let i = 0; i < planned.length; i += 1) {
    const { id, description, outputPath, masterPrompt, outputBackground } = planned[i]
    const positivePrompt = buildPrompt(masterPrompt, description)

    console.log(`[${i + 1}/${planned.length}] Generating ${id}...`)
    await provider.generate({
      id,
      outputPath,
      positivePrompt,
      negativePrompt: NEGATIVE_PROMPT,
      outputBackground,
    })
    console.log(`Saved ${outputPath}`)
  }

  console.log('Done.')
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})

function createProvider(opts) {
  if (opts.provider === 'openai') {
    return createOpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: opts.model,
      size: opts.size,
      background: opts.background,
    })
  }

  if (opts.provider === 'comfyui') {
    if (!opts.comfyCheckpoint && !opts.dryRun) {
      throw new Error('COMFYUI_CHECKPOINT or --comfy-checkpoint is required for provider=comfyui.')
    }

    return createComfyUIProvider({
      endpoint: opts.comfyUrl,
      checkpoint: opts.comfyCheckpoint,
      size: opts.size,
      steps: opts.comfySteps,
      cfg: opts.comfyCfg,
      samplerName: opts.comfySampler,
      scheduler: opts.comfyScheduler,
      denoise: opts.comfyDenoise,
      pollMs: opts.comfyPollMs,
      timeoutMs: opts.comfyTimeoutMs,
    })
  }

  throw new Error(`Unsupported provider: ${opts.provider}`)
}
