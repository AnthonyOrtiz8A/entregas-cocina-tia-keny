import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { config } from '../config.js'
import { revisarUrgencias } from '../lib/notificaciones.js'
import { requireAuth } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

export const avisoRoutes = new Hono<AppEnv>()
  // La app abierta en cualquier teléfono la llama cada minuto: así llegan los avisos a todos
  .post('/revisar', requireAuth, async (c) => c.json({ enviados: await revisarUrgencias(c.var.db) }))

  // Para un servicio de cron externo (ej. cron-job.org) cuando nadie tiene la app abierta
  .get('/cron', async (c) => {
    if (!config.cronSecret || c.req.header('Authorization') !== `Bearer ${config.cronSecret}`) {
      throw new HTTPException(401, { message: 'No autorizado' })
    }
    return c.json({ enviados: await revisarUrgencias(c.var.db) })
  })
