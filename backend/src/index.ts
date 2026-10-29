import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'
import { config } from './config'
import { db } from './db/client'
import { requireAuth } from './middleware/auth'
import { authRoutes } from './routes/auth'
import { configuracionRoutes } from './routes/configuracion'
import { entregaRoutes } from './routes/entregas'
import { ubicacionRoutes } from './routes/ubicacion'
import { usuarioRoutes } from './routes/usuarios'
import type { AppEnv } from './types'

export const app = new Hono<AppEnv>()

app.use(logger())

app.use(
  '/api/*',
  cors({
    origin: (origin) => (config.frontendUrls.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }),
)

app.use('/api/*', async (c, next) => {
  c.set('db', db)
  await next()
})

app.get('/', (c) => c.json({ ok: true, servicio: 'Entregas Cocina Tía Keny' }))

app.route('/api/auth', authRoutes)
app.use('/api/entregas/*', requireAuth)
app.use('/api/usuarios/*', requireAuth)
app.use('/api/configuracion/*', requireAuth)
app.use('/api/ubicacion/*', requireAuth)
app.route('/api/entregas', entregaRoutes)
app.route('/api/usuarios', usuarioRoutes)
app.route('/api/configuracion', configuracionRoutes)
app.route('/api/ubicacion', ubicacionRoutes)

app.notFound((c) => c.json({ message: 'Ruta no encontrada' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ message: err.message }, err.status)
  console.error(err)
  return c.json({ message: 'Error interno del servidor' }, 500)
})

// Vercel detecta Hono y usa este export como función del servidor
export default app
