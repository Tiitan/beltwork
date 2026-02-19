#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parseArgs as parseNodeArgs } from 'node:util'
import { createComfyUIProvider } from './image-providers/comfyui.mjs'
import { createOpenAIProvider } from './image-providers/openai.mjs'

const GAME_ASSETS_CONFIG = 'gameconfig/game_assets.json'
const NEGATIVE_PROMPT =
  'photorealistic, horror, violence, blood, logo, watermark, text, UI glyphs, over-sharpened, noisy, low-contrast mush, person, people, human, humanoid, character, portrait, face, hands'

function parseArgs(argv) {
  const defaults = {
    provider: process.env.ASSET_IMAGE_PROVIDER || 'comfyui',
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
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
    seedBase: 740001,
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
      'seed-base': { type: 'string' },
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
    seedBase: parseNumber(values['seed-base'], defaults.seedBase),
    dryRun: values['dry-run'] ?? defaults.dryRun,
    rebuildAll: values['rebuild-all'] ?? defaults.rebuildAll,
    only,
    limit,
  }
}

function printHelp() {
  console.log('Usage: npm run assets:generate:game -- -- [options]')
  console.log('')
  console.log('Options:')
  console.log('  --dry-run                   Print plan without generating images')
  console.log('  --provider <name>           Provider: comfyui (default) or openai')
  console.log('  --model <name>              Image model (default: gpt-image-1)')
  console.log('  --background <mode>         OpenAI background override')
  console.log('  --comfy-url <url>           ComfyUI endpoint (default: http://127.0.0.1:8188)')
  console.log('  --comfy-checkpoint <name>   ComfyUI checkpoint name (required for comfyui)')
  console.log('  --comfy-steps <n>           ComfyUI sampler steps (default: 28)')
  console.log('  --comfy-cfg <n>             ComfyUI cfg scale (default: 7)')
  console.log('  --comfy-sampler <name>      ComfyUI sampler (default: euler)')
  console.log('  --comfy-scheduler <name>    ComfyUI scheduler (default: normal)')
  console.log('  --comfy-denoise <n>         ComfyUI denoise strength (default: 1)')
  console.log('  --comfy-poll-ms <n>         ComfyUI poll interval ms (default: 1200)')
  console.log('  --comfy-timeout-ms <n>      ComfyUI timeout ms (default: 120000)')
  console.log('  --seed-base <n>             Base seed for deterministic generation order')
  console.log('  --rebuild-all               Regenerate all assets, including existing files')
  console.log('  --only <id,id,...>          Generate only specific asset ids')
  console.log('  --limit <n>                 Generate only first n selected assets')
  console.log('  --help                      Show this help text')
}

async function loadGameAssetSpecs() {
  const raw = await fs.readFile(GAME_ASSETS_CONFIG, 'utf8')
  const sanitized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const json = JSON.parse(sanitized)
  const entries = json.game_assets
  if (!Array.isArray(entries)) {
    throw new Error(`Expected array at ${GAME_ASSETS_CONFIG} -> game_assets`)
  }

  const seen = new Set()
  const specs = []
  for (const entry of entries) {
    const id = entry?.id
    const outputPath = entry?.output_path
    const size = entry?.size
    const outputBackground = entry?.output_background
    const masterPrompt = entry?.master_prompt
    const description = entry?.asset_visual_description

    if (!id || typeof id !== 'string') {
      throw new Error('Each game asset requires a string id.')
    }
    if (seen.has(id)) {
      throw new Error(`Duplicate game asset id: ${id}`)
    }
    seen.add(id)
    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error(`Missing output_path for ${id}`)
    }
    if (!size || typeof size !== 'string') {
      throw new Error(`Missing size for ${id}`)
    }
    if (outputBackground !== 'opaque') {
      throw new Error(`Invalid output_background for ${id}. Expected "opaque".`)
    }
    if (!masterPrompt || typeof masterPrompt !== 'string') {
      throw new Error(`Missing master_prompt for ${id}`)
    }
    if (!description || typeof description !== 'string') {
      throw new Error(`Missing asset_visual_description for ${id}`)
    }

    specs.push({
      id,
      outputPath: path.resolve(outputPath),
      size,
      outputBackground,
      masterPrompt,
      description,
    })
  }

  return specs
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

function createProvider(opts, size, seed) {
  if (opts.provider === 'openai') {
    return createOpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: opts.model,
      size,
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
      size,
      steps: opts.comfySteps,
      cfg: opts.comfyCfg,
      samplerName: opts.comfySampler,
      scheduler: opts.comfyScheduler,
      denoise: opts.comfyDenoise,
      pollMs: opts.comfyPollMs,
      timeoutMs: opts.comfyTimeoutMs,
      seed,
    })
  }

  throw new Error(`Unsupported provider: ${opts.provider}`)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const allSpecs = await loadGameAssetSpecs()
  let selected = allSpecs

  if (opts.only) {
    selected = selected.filter((spec) => opts.only.has(spec.id))
  }
  if (opts.limit) {
    selected = selected.slice(0, opts.limit)
  }

  if (selected.length === 0) {
    console.log('No game asset ids selected. Nothing to generate.')
    return
  }

  const planned = []
  let skippedExisting = 0
  for (const spec of selected) {
    await fs.mkdir(path.dirname(spec.outputPath), { recursive: true })
    const exists = await fileExists(spec.outputPath)
    if (!opts.rebuildAll && exists) {
      skippedExisting += 1
      continue
    }
    planned.push(spec)
  }

  console.log(`Manifest: ${GAME_ASSETS_CONFIG}`)
  console.log(`Provider: ${opts.provider}`)
  console.log(`Model: ${opts.model}`)
  console.log(`Selected assets: ${selected.length}`)
  console.log(`Existing skipped: ${skippedExisting}`)
  console.log(`To generate: ${planned.length}`)

  if (opts.dryRun) {
    for (const spec of planned) {
      console.log(`[dry-run] generate ${spec.id}.png @ ${spec.size} -> ${spec.outputPath}`)
    }
    return
  }

  if (planned.length === 0) {
    console.log('Nothing to generate. Use --rebuild-all to regenerate existing assets.')
    return
  }

  for (let i = 0; i < planned.length; i += 1) {
    const spec = planned[i]
    const seed = opts.seedBase + i
    const provider = createProvider(opts, spec.size, seed)
    const positivePrompt = buildPrompt(spec.masterPrompt, spec.description)

    console.log(`[${i + 1}/${planned.length}] Generating ${spec.id} (${spec.size})...`)
    await provider.generate({
      id: spec.id,
      outputPath: spec.outputPath,
      positivePrompt,
      negativePrompt: NEGATIVE_PROMPT,
      outputBackground: spec.outputBackground,
    })
    console.log(`Saved ${spec.outputPath}`)
  }

  console.log('Done.')
}

main().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
