import { env } from './config.js'
import { buildServer } from './server.js'

/**
 * Boots the API server process with configured host and port.
 *
 * @returns Resolves when the server starts listening.
 */
async function start() {
  const server = buildServer()

  try {
    await server.listen({
      port: env.PORT,
      host: '0.0.0.0',
    })
  } catch (error) {
    server.log.error(error)
    process.exit(1)
  }
}

/**
 * Starts the API runtime on module load.
 */
start()
