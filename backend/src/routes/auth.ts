import { count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { config } from '../config'
import { usuarios } from '../db/schema'
import { hashPassword, verifyPassword } from '../lib/password'
import { createTokens, publicUser, readToken } from '../lib/tokens'
import { parseBody } from '../lib/validate'
import { requireAuth } from '../middleware/auth'
import type { AppEnv } from '../types'

const loginSchema = z.object({
  usuario: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
})

const setupSchema = z.object({
  nombre: z.string().trim().min(2),
  usuario: z.string().trim().toLowerCase().min(3),
  password: z.string().min(6),
})

export const authRoutes = new Hono<AppEnv>()
  // Indica si aún no existe ningún usuario (primer uso de la app)
  .get('/estado', async (c) => {
    const [row] = await c.var.db.select({ n: count() }).from(usuarios)
    return c.json({ necesitaConfiguracion: (row?.n ?? 0) === 0 })
  })

  // Crea el primer administrador. Solo funciona si la tabla está vacía.
  .post('/setup', async (c) => {
    const data = await parseBody(c, setupSchema)
    const [row] = await c.var.db.select({ n: count() }).from(usuarios)
    if ((row?.n ?? 0) > 0) throw new HTTPException(409, { message: 'La aplicación ya fue configurada' })

    const [user] = await c.var.db
      .insert(usuarios)
      .values({ ...data, passwordHash: await hashPassword(data.password), rol: 'admin' })
      .returning()
    return c.json({ usuario: publicUser(user!), ...(await createTokens(user!, config.jwtSecret)) }, 201)
  })

  .post('/login', async (c) => {
    const { usuario, password } = await parseBody(c, loginSchema)
    const user = await c.var.db.query.usuarios.findFirst({ where: eq(usuarios.usuario, usuario) })
    if (!user || !user.activo || !(await verifyPassword(password, user.passwordHash))) {
      throw new HTTPException(401, { message: 'Usuario o contraseña incorrectos' })
    }
    return c.json({ usuario: publicUser(user), ...(await createTokens(user, config.jwtSecret)) })
  })

  .post('/refresh', async (c) => {
    const { refreshToken } = await parseBody(c, z.object({ refreshToken: z.string().min(1) }))
    let sub: number
    try {
      sub = (await readToken(refreshToken, config.jwtSecret, 'refresh')).sub
    } catch {
      throw new HTTPException(401, { message: 'Sesión expirada' })
    }
    // Se vuelve a leer el usuario para reflejar cambios de rol o desactivación
    const user = await c.var.db.query.usuarios.findFirst({ where: eq(usuarios.id, sub) })
    if (!user || !user.activo) throw new HTTPException(401, { message: 'Usuario no disponible' })
    return c.json({ usuario: publicUser(user), ...(await createTokens(user, config.jwtSecret)) })
  })

  .get('/me', requireAuth, async (c) => {
    const user = await c.var.db.query.usuarios.findFirst({ where: eq(usuarios.id, c.var.user.sub) })
    if (!user || !user.activo) throw new HTTPException(401, { message: 'Usuario no disponible' })
    return c.json(publicUser(user))
  })
