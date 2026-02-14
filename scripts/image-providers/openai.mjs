import fs from 'node:fs/promises'
import OpenAI from 'openai'

async function writePngFromResponse(imageData, outputPath) {
  if (imageData.b64_json) {
    await fs.writeFile(outputPath, Buffer.from(imageData.b64_json, 'base64'))
    return
  }

  if (imageData.url) {
    const response = await fetch(imageData.url)
    if (!response.ok) {
      throw new Error(`Failed to download image from URL: HTTP ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer))
    return
  }

  throw new Error('Image response did not include b64_json or url payload.')
}

export function createOpenAIProvider(config) {
  return {
    name: 'openai',
    async generate(spec) {
      if (!config.apiKey) {
        throw new Error('OPENAI_API_KEY is required for provider=openai.')
      }

      const client = new OpenAI({ apiKey: config.apiKey })
      const prompt = `${spec.positivePrompt} Avoid: ${spec.negativePrompt}`
      const background = spec.outputBackground ?? config.background ?? undefined
      const image = await client.images.generate({
        model: config.model,
        size: config.size,
        background,
        output_format: 'png',
        prompt,
      })

      const first = image?.data?.[0]
      if (!first) {
        throw new Error(`No image output returned for ${spec.id}`)
      }

      await writePngFromResponse(first, spec.outputPath)
    },
  }
}
