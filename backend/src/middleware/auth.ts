import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { config } from '../config'
import { readToken } from '../lib/tokens'
import type { AppEnv, Rol } from '../types'

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HTTPException(401, { message: 'No autenticado' })
  try {
    c.set('user', await readToken(token, config.jwtSecret, 'access'))
  } catch {
    throw new HTTPException(401, { message: 'Sesión expirada' })
  }
  await next()
})

export const requireRole = (...roles: Rol[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get('user').rol)) {
      throw new HTTPException(403, { message: 'No tienes permiso para esta acción' })
    }
    await next()
  })
