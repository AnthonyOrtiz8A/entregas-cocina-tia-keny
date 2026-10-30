import { and, asc, count, eq, gte, sql, sum } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { entregas } from '../db/schema.js'
import { avisoCambio, avisoNueva, notificar } from '../lib/notificaciones.js'
import { parseBody } from '../lib/validate.js'
import { requireRole } from '../middleware/auth.js'
import type { AppEnv } from '../types.js'

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha AAAA-MM-DD')

const entregaSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Nombre muy corto'),
    telefono: z.string().trim().min(8, 'Teléfono inválido').max(20),
    direccion: z.string().trim().min(3, 'Dirección muy corta'),
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    fecha: fechaSchema,
    hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)'),
    enteros: z.number().int().min(0),
    medios: z.number().int().min(0),
    extras: z.string().trim().max(500).nullable().default(null),
    extrasMonto: z.number().min(0).default(0),
    total: z.number().min(0),
    estadoPago: z.enum(['pendiente', 'pagado']).default('pendiente'),
    notas: z.string().trim().max(500).nullable().default(null),
  })
  .refine((d) => d.enteros + d.medios > 0, { message: 'Debe llevar al menos un fiambre', path: ['enteros'] })

const estadoSchema = z
  .object({
    entregado: z.boolean().optional(),
    estadoPago: z.enum(['pendiente', 'pagado']).optional(),
  })
  .refine((d) => d.entregado !== undefined || d.estadoPago !== undefined, { message: 'Nada que actualizar' })

const idParam = (raw: string) => {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) throw new HTTPException(400, { message: 'ID inválido' })
  return id
}

export const entregaRoutes = new Hono<AppEnv>()
  // Entregas de un día, en el orden en que se registraron (el id crece con cada pedido nuevo)
  .get('/', async (c) => {
    const fecha = fechaSchema.safeParse(c.req.query('fecha'))
    if (!fecha.success) throw new HTTPException(400, { message: 'Parámetro fecha requerido (AAAA-MM-DD)' })
    const rows = await c.var.db
      .select()
      .from(entregas)
      .where(eq(entregas.fecha, fecha.data))
      .orderBy(asc(entregas.id))
    return c.json(rows)
  })

  // Resumen por día (desde una fecha) para el selector de días
  .get('/dias', async (c) => {
    const desde = fechaSchema.safeParse(c.req.query('desde'))
    const rows = await c.var.db
      .select({
        fecha: entregas.fecha,
        total: count(),
        pendientes: sql<number>`count(*) filter (where ${entregas.entregado} = false)`.mapWith(Number),
        enteros: sum(entregas.enteros).mapWith(Number),
        medios: sum(entregas.medios).mapWith(Number),
      })
      .from(entregas)
      .where(desde.success ? gte(entregas.fecha, desde.data) : undefined)
      .groupBy(entregas.fecha)
      .orderBy(asc(entregas.fecha))
      .limit(60)
    return c.json(rows)
  })

  .get('/:id', async (c) => {
    const row = await c.var.db.query.entregas.findFirst({ where: eq(entregas.id, idParam(c.req.param('id'))) })
    if (!row) throw new HTTPException(404, { message: 'Entrega no encontrada' })
    return c.json(row)
  })

  .post('/', requireRole('admin'), async (c) => {
    const data = await parseBody(c, entregaSchema)
    const [row] = await c.var.db
      .insert(entregas)
      .values({ ...data, creadoPor: c.var.user.sub })
      .returning()
    await notificar(c.var.db, avisoNueva(row!), { excepto: c.var.user.sub })
    return c.json(row, 201)
  })

  .put('/:id', requireRole('admin'), async (c) => {
    const id = idParam(c.req.param('id'))
    const data = await parseBody(c, entregaSchema)
    const antes = await c.var.db.query.entregas.findFirst({ where: eq(entregas.id, id) })
    if (!antes) throw new HTTPException(404, { message: 'Entrega no encontrada' })
    // Con otra hora se vuelven a avisar la advertencia y el atraso
    const cambioHora = antes.fecha !== data.fecha || antes.hora !== data.hora
    // Una entrega ya entregada no se edita: primero hay que deshacer la entrega
    const [row] = await c.var.db
      .update(entregas)
      .set({ ...data, actualizadoEn: new Date(), ...(cambioHora && { avisoEnviado: null }) })
      .where(and(eq(entregas.id, id), eq(entregas.entregado, false)))
      .returning()
    if (!row) {
      throw new HTTPException(409, { message: 'La entrega ya fue entregada. Deshaz la entrega para poder editarla.' })
    }
    const aviso = avisoCambio(antes, row)
    if (aviso) await notificar(c.var.db, aviso, { excepto: c.var.user.sub })
    return c.json(row)
  })

  // Marcar entregada / pagada: disponible para repartidores también
  .patch('/:id/estado', async (c) => {
    const data = await parseBody(c, estadoSchema)
    const [row] = await c.var.db
      .update(entregas)
      .set({
        ...data,
        ...(data.entregado !== undefined && { entregadoEn: data.entregado ? new Date() : null }),
        actualizadoEn: new Date(),
      })
      .where(eq(entregas.id, idParam(c.req.param('id'))))
      .returning()
    if (!row) throw new HTTPException(404, { message: 'Entrega no encontrada' })
    return c.json(row)
  })

  .delete('/:id', requireRole('admin'), async (c) => {
    const [row] = await c.var.db
      .delete(entregas)
      .where(eq(entregas.id, idParam(c.req.param('id'))))
      .returning({ id: entregas.id })
    if (!row) throw new HTTPException(404, { message: 'Entrega no encontrada' })
    return c.body(null, 204)
  })
