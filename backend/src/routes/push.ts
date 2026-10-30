import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { config } from '../config.js'
import { suscripciones } from '../db/schema.js'
import { notificar, pushActivo } from '../lib/notificaciones.js'
import { parseBody } from '../lib/validate.js'
import type { AppEnv } from '../types.js'

const suscripcionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

export const pushRoutes = new Hono<AppEnv>()
  // Clave pública para que el navegador se suscriba (null si el servidor no tiene push configurado)
  .get('/clave', (c) => c.json({ clave: pushActivo() ? config.vapid.publica : null }))

  // Guarda la suscripción de este teléfono para el usuario actual
  .post('/suscripcion', async (c) => {
    const { endpoint, keys } = await parseBody(c, suscripcionSchema)
    const valores = { usuarioId: c.var.user.sub, p256dh: keys.p256dh, auth: keys.auth }
    await c.var.db
      .insert(suscripciones)
      .values({ endpoint, ...valores })
      .onConflictDoUpdate({ target: suscripciones.endpoint, set: valores })
    return c.body(null, 204)
  })

  // Prueba: manda una notificación solo a los teléfonos del usuario actual y cuenta lo que pasó
  .post('/prueba', async (c) => {
    if (!pushActivo()) return c.json({ configurado: false, telefonos: 0, enviados: 0, errores: [] })
    const resultado = await notificar(
      c.var.db,
      { id: `prueba-${Date.now()}`, titulo: '🔔 Prueba de notificación', cuerpo: 'Si ves esto, las notificaciones funcionan en este teléfono.', voz: 'Prueba de notificación. Así se escucharán los avisos de entregas' },
      { soloUsuario: c.var.user.sub },
    )
    return c.json({ configurado: true, ...resultado })
  })

  // Al cerrar sesión este teléfono deja de recibir notificaciones
  .delete('/suscripcion', async (c) => {
    const { endpoint } = await parseBody(c, z.object({ endpoint: z.string().min(1) }))
    await c.var.db.delete(suscripciones).where(eq(suscripciones.endpoint, endpoint))
    return c.body(null, 204)
  })
