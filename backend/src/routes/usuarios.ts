import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { usuarios } from '../db/schema'
import { hashPassword } from '../lib/password'
import { publicUser } from '../lib/tokens'
import { parseBody } from '../lib/validate'
import { requireRole } from '../middleware/auth'
import type { AppEnv } from '../types'

const crearSchema = z.object({
  nombre: z.string().trim().min(2),
  usuario: z.string().trim().toLowerCase().min(3).regex(/^[a-z0-9._-]+$/, 'Solo letras, números, punto o guion'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol: z.enum(['admin', 'repartidor']),
})

const editarSchema = z.object({
  nombre: z.string().trim().min(2).optional(),
  password: z.string().min(6, 'Mínimo 6 caracteres').optional(),
  rol: z.enum(['admin', 'repartidor']).optional(),
  activo: z.boolean().optional(),
})

export const usuarioRoutes = new Hono<AppEnv>()
  .use(requireRole('admin'))

  .get('/', async (c) => {
    const rows = await c.var.db.select().from(usuarios).orderBy(asc(usuarios.nombre))
    return c.json(rows.map(publicUser))
  })

  .post('/', async (c) => {
    const { password, ...data } = await parseBody(c, crearSchema)
    const existe = await c.var.db.query.usuarios.findFirst({ where: eq(usuarios.usuario, data.usuario) })
    if (existe) throw new HTTPException(409, { message: 'Ese nombre de usuario ya existe' })
    const [row] = await c.var.db
      .insert(usuarios)
      .values({ ...data, passwordHash: await hashPassword(password) })
      .returning()
    return c.json(publicUser(row!), 201)
  })

  .patch('/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const { password, ...data } = await parseBody(c, editarSchema)
    if (id === c.var.user.sub && (data.activo === false || data.rol === 'repartidor')) {
      throw new HTTPException(400, { message: 'No puedes quitarte el acceso de administrador a ti mismo' })
    }
    const [row] = await c.var.db
      .update(usuarios)
      .set({ ...data, ...(password && { passwordHash: await hashPassword(password) }) })
      .where(eq(usuarios.id, id))
      .returning()
    if (!row) throw new HTTPException(404, { message: 'Usuario no encontrado' })
    return c.json(publicUser(row))
  })
