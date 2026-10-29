import { serve } from '@hono/node-server'
import { config } from './config'
import { app } from './index'

// Cloud Run define PORT (8080); en local se usa 8787
const server = serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
  console.log(`API escuchando en http://localhost:${info.port}`)
})

// Cloud Run envía SIGTERM antes de apagar la instancia
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
