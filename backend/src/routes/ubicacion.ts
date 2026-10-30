import { and, asc, eq, gte } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { ubicaciones, usuarios } from '../db/schema.js'
import { parseBody } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const ubicacionSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  precision: z.number().min(0).nullable().default(null),
})

// Ubicaciones más viejas que esto ya no se muestran
const HORAS_VIGENCIA = 12

export const ubicacionRoutes = new Hono<AppEnv>()
  // El usuario actual comparte su ubicación
  .put('/', async (c) => {
    const data = await parseBody(c, ubicacionSchema)
    const valores = { ...data, actualizadoEn: new Date() }
    await c.var.db
      .insert(ubicaciones)
      .values({ usuarioId: c.var.user.sub, ...valores })
      .onConflictDoUpdate({ target: ubicaciones.usuarioId, set: valores })
    return c.body(null, 204)
  })

  // Deja de compartir: se borra su última ubicación
  .delete('/', async (c) => {
    await c.var.db.delete(ubicaciones).where(eq(ubicaciones.usuarioId, c.var.user.sub))
    return c.body(null, 204)
  })

  // Administradores: dónde están los repartidores
  .get('/repartidores', requireRole('admin'), async (c) => {
    const desde = new Date(Date.now() - HORAS_VIGENCIA * 3_600_000)
    const rows = await c.var.db
      .select({
        usuarioId: ubicaciones.usuarioId,
        nombre: usuarios.nombre,
        lat: ubicaciones.lat,
        lng: ubicaciones.lng,
        precision: ubicaciones.precision,
        actualizadoEn: ubicaciones.actualizadoEn,
      })
      .from(ubicaciones)
      .innerJoin(usuarios, eq(usuarios.id, ubicaciones.usuarioId))
      .where(and(eq(usuarios.activo, true), eq(usuarios.rol, 'repartidor'), gte(ubicaciones.actualizadoEn, desde)))
      .orderBy(asc(usuarios.nombre))
    return c.json(rows)
  })
