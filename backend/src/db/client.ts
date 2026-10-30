import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.js'
import * as schema from './schema.js'

// Un solo pool de conexiones para todo el proceso.
// prepare: false es necesario con el pooler de Neon (PgBouncer).
const client = postgres(config.databaseUrl, { max: 5, prepare: false, idle_timeout: 20 })

export const db = drizzle({ client, schema })

export type Db = typeof db
