// Crea la base de datos de DATABASE_URL si todavía no existe (útil con Postgres local)
import postgres from 'postgres'

const url = new URL(process.env.DATABASE_URL ?? '')
const nombre = decodeURIComponent(url.pathname.slice(1))
if (!nombre) throw new Error('DATABASE_URL no indica el nombre de la base de datos')

// Conecta a la base "postgres" del mismo servidor para poder crear la nueva
url.pathname = '/postgres'
const sql = postgres(url.toString(), { max: 1, onnotice: () => {} })

try {
  const existe = await sql`select 1 from pg_database where datname = ${nombre}`
  if (existe.length) {
    console.log(`La base de datos "${nombre}" ya existe`)
  } else {
    await sql.unsafe(`create database "${nombre.replace(/"/g, '""')}"`)
    console.log(`Base de datos "${nombre}" creada`)
  }
} catch (err) {
  const e = err as { code?: string; message: string }
  if (e.code === '28P01') console.error('Contraseña incorrecta: revisa DATABASE_URL en backend/.env')
  else if (e.code === 'ECONNREFUSED') console.error('No hay un Postgres escuchando en esa dirección/puerto')
  else console.error(e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
