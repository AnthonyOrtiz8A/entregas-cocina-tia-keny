// Genera frontend/public/lugares.json con los negocios y lugares conocidos de la zona,
// a partir de los datos abiertos de Overture Maps (gratis, licencia CDLA Permissive 2.0).
//
// Uso (solo hace falta cuando se quieran actualizar los lugares):
//   cd herramientas/lugares
//   npm install
//   npm run generar
import { DuckDBInstance } from '@duckdb/node-api'
import { writeFileSync } from 'node:fs'

// Versión de los datos: la lista está en https://stac.overturemaps.org/catalog.json ("latest")
const VERSION = process.env.OVERTURE_VERSION ?? '2026-10-21.0'
// Chiquimulilla y alrededores (incluye Guazacapán)
const ZONA = { oeste: -90.42, este: -90.34, sur: 14.05, norte: 14.12 }
const CONFIANZA_MINIMA = 0.5
const SALIDA = new URL('../../frontend/public/lugares.json', import.meta.url)

const db = await DuckDBInstance.create(':memory:')
const c = await db.connect()
await c.run("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; SET s3_region='us-west-2';")
const r = await c.runAndReadAll(`
  SELECT names.primary AS nombre, basic_category AS categoria, confidence AS confianza,
         operating_status AS estado, addresses[1].freeform AS direccion,
         ST_Y(geometry) AS lat, ST_X(geometry) AS lng
  FROM read_parquet('s3://overturemaps-us-west-2/release/${VERSION}/theme=places/type=place/*', hive_partitioning=1)
  WHERE bbox.xmin BETWEEN ${ZONA.oeste} AND ${ZONA.este} AND bbox.ymin BETWEEN ${ZONA.sur} AND ${ZONA.norte}
`)

const candidatos = r
  .getRowObjectsJson()
  .filter((l) => l.nombre && l.confianza >= CONFIANZA_MINIMA && l.estado !== 'permanently_closed')
  .sort((a, b) => b.confianza - a.confianza)

// Distintas fuentes repiten el mismo lugar: se queda el de mayor confianza si están a menos de 150 m
const metros = (a, b) => {
  const rad = Math.PI / 180
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  const y = (b.lat - a.lat) * rad
  return Math.hypot(x, y) * 6_371_000
}
const normalizar = (s) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
const lugares = []
for (const l of candidatos) {
  const repetido = lugares.some((o) => normalizar(o.n) === normalizar(l.nombre) && metros(o, l) < 150)
  if (repetido) continue
  lugares.push({
    n: l.nombre.replace(/\s+/g, ' ').trim(),
    c: l.categoria ?? null,
    d: l.direccion ?? null,
    // Confianza de que el lugar existe y está bien ubicado (0 a 1): decide cuáles se ven primero
    p: Math.round(l.confianza * 100) / 100,
    lat: Math.round(Number(l.lat) * 1e6) / 1e6,
    lng: Math.round(Number(l.lng) * 1e6) / 1e6,
  })
}
lugares.sort((a, b) => a.n.localeCompare(b.n, 'es'))

writeFileSync(SALIDA, JSON.stringify({ fuente: `Overture Maps ${VERSION}`, lugares }))
console.log(`${lugares.length} lugares guardados en frontend/public/lugares.json`)
