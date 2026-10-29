import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { configuracion } from '../db/schema'
import { parseBody } from '../lib/validate'
import { requireRole } from '../middleware/auth'
import type { AppEnv } from '../types'

const DEFAULTS = { id: 1, precioEntero: 0, precioMedio: 0, minutosAdvertencia: 30 }

const configSchema = z.object({
  precioEntero: z.number().min(0),
  precioMedio: z.number().min(0),
  minutosAdvertencia: z.number().int().min(5).max(240),
})

export const configuracionRoutes = new Hono<AppEnv>()
  .get('/', async (c) => {
    const row = await c.var.db.query.configuracion.findFirst({ where: eq(configuracion.id, 1) })
    return c.json(row ?? DEFAULTS)
  })

  .put('/', requireRole('admin'), async (c) => {
    const data = await parseBody(c, configSchema)
    const [row] = await c.var.db
      .insert(configuracion)
      .values({ id: 1, ...data })
      .onConflictDoUpdate({ target: configuracion.id, set: data })
      .returning()
    return c.json(row)
  })
