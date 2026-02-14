import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function parseSize(size) {
  const match = /^(\d+)x(\d+)$/i.exec(size)
  if (!match) {
    throw new Error(`Invalid size format: ${size}. Expected <width>x<height>.`)
  }

  const width = Number.parseInt(match[1], 10)
  const height = Number.parseInt(match[2], 10)
  return { width, height }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKFLOW_TEMPLATE_PATH = path.join(__dirname, 'comfyui-workflow.json')

async function loadWorkflowTemplate() {
  const raw = await fs.readFile(WORKFLOW_TEMPLATE_PATH, 'utf8')
  return JSON.parse(raw)
}

function replacePlaceholders(value, placeholders) {
  if (typeof value === 'string') {
    if (Object.prototype.hasOwnProperty.call(placeholders, value)) {
      return placeholders[value]
    }
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, placeholders))
  }

  if (value && typeof value === 'object') {
    const output = {}
    for (const [key, childValue] of Object.entries(value)) {
      output[key] = replacePlaceholders(childValue, placeholders)
    }
    return output
  }

  return value
}

function buildWorkflowFromTemplate(template, placeholders) {
  return replacePlaceholders(template, placeholders)
}

function extractImageRef(history, promptId) {
  const run = history?.[promptId]
  const outputs = run?.outputs
  if (!outputs || typeof outputs !== 'object') {
    return null
  }

  for (const nodeOutput of Object.values(outputs)) {
    const images = nodeOutput?.images
    if (Array.isArray(images) && images.length > 0) {
      return images[0]
    }
  }

  return null
}

async function downloadComfyImage(endpoint, imageRef, outputPath) {
  const url = new URL('/view', endpoint)
  url.searchParams.set('filename', imageRef.filename)
  url.searchParams.set('subfolder', imageRef.subfolder ?? '')
  url.searchParams.set('type', imageRef.type ?? 'output')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`ComfyUI image download failed: HTTP ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer))
}

export function createComfyUIProvider(config) {
  const endpoint = new URL(config.endpoint.endsWith('/') ? config.endpoint : `${config.endpoint}/`)
  const { width, height } = parseSize(config.size)
  const seed = config.seed ?? Math.floor(Math.random() * 9_999_999_999)
  const workflowTemplatePromise = loadWorkflowTemplate()

  return {
    name: 'comfyui',
    async generate(spec) {
      if (!config.checkpoint) {
        throw new Error(
          'COMFYUI_CHECKPOINT or --comfy-checkpoint is required for provider=comfyui.',
        )
      }

      const workflowTemplate = await workflowTemplatePromise
      const promptGraph = buildWorkflowFromTemplate(workflowTemplate, {
        __CHECKPOINT__: config.checkpoint,
        __POSITIVE_PROMPT__: spec.positivePrompt,
        __NEGATIVE_PROMPT__: spec.negativePrompt,
        __WIDTH__: width,
        __HEIGHT__: height,
        __SEED__: seed,
        __STEPS__: config.steps,
        __CFG__: config.cfg,
        __SAMPLER_NAME__: config.samplerName,
        __SCHEDULER__: config.scheduler,
        __DENOISE__: config.denoise,
        __FILENAME_PREFIX__: spec.id,
      })

      const promptResponse = await fetch(new URL('/prompt', endpoint), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: promptGraph }),
      })

      if (!promptResponse.ok) {
        const body = await promptResponse.text()
        throw new Error(`ComfyUI prompt submission failed: HTTP ${promptResponse.status} ${body}`)
      }

      const promptJson = await promptResponse.json()
      const promptId = promptJson?.prompt_id
      if (!promptId) {
        throw new Error('ComfyUI response missing prompt_id.')
      }

      const deadline = Date.now() + config.timeoutMs
      while (Date.now() < deadline) {
        const historyResponse = await fetch(new URL(`/history/${promptId}`, endpoint))
        if (!historyResponse.ok) {
          throw new Error(`ComfyUI history lookup failed: HTTP ${historyResponse.status}`)
        }

        const history = await historyResponse.json()
        const imageRef = extractImageRef(history, promptId)
        if (imageRef) {
          await downloadComfyImage(endpoint, imageRef, spec.outputPath)
          return
        }

        await sleep(config.pollMs)
      }

      throw new Error(`Timed out waiting for ComfyUI output for ${spec.id}.`)
    },
  }
}
