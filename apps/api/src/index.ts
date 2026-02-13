import { env } from './config.js'
import { buildServer } from './server.js'

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

start()
