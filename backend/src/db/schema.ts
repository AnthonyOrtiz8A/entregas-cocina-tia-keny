import {
  boolean,
  date,
  doublePrecision,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  usuario: text('usuario').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  rol: text('rol', { enum: ['admin', 'repartidor'] }).notNull().default('repartidor'),
  activo: boolean('activo').notNull().default(true),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})

export const entregas = pgTable('entregas', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  telefono: text('telefono').notNull(),
  direccion: text('direccion').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  // Fecha y hora locales (Guatemala) en que se debe entregar
  fecha: date('fecha', { mode: 'string' }).notNull(),
  // Opcional: null = sin hora definida (no se marca urgente ni se avisa por hora)
  hora: text('hora'),
  enteros: integer('enteros').notNull().default(0),
  medios: integer('medios').notNull().default(0),
  extras: text('extras'),
  extrasMonto: numeric('extras_monto', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  estadoPago: text('estado_pago', { enum: ['pendiente', 'pagado'] }).notNull().default('pendiente'),
  entregado: boolean('entregado').notNull().default(false),
  entregadoEn: timestamp('entregado_en', { withTimezone: true }),
  notas: text('notas'),
  // Último aviso de urgencia enviado ('advertencia' | 'urgente'); se reinicia al cambiar la hora
  avisoEnviado: text('aviso_enviado', { enum: ['advertencia', 'urgente'] }),
  creadoPor: integer('creado_por').references(() => usuarios.id, { onDelete: 'set null' }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})

// Una sola fila (id = 1) con los ajustes del negocio
export const configuracion = pgTable('configuracion', {
  id: integer('id').primaryKey().default(1),
  precioEntero: numeric('precio_entero', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  precioMedio: numeric('precio_medio', { precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
  minutosAdvertencia: integer('minutos_advertencia').notNull().default(30),
})

export type Usuario = typeof usuarios.$inferSelect
export type Entrega = typeof entregas.$inferSelect

// Última ubicación conocida de cada usuario que comparte su ubicación (una fila por usuario)
export const ubicaciones = pgTable('ubicaciones', {
  usuarioId: integer('usuario_id')
    .primaryKey()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  precision: doublePrecision('precision'),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
})

// Teléfonos/navegadores que aceptaron recibir notificaciones (Web Push)
export const suscripciones = pgTable('suscripciones', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
})
