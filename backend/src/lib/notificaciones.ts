import { and, eq, inArray, isNull, ne, or, type Column } from 'drizzle-orm'
import webpush from 'web-push'
import { config } from '../config.js'
import type { Db } from '../db/client.js'
import { configuracion, entregas, suscripciones, usuarios, type Entrega } from '../db/schema.js'

export interface Aviso {
  titulo: string
  cuerpo: string
  // Mismo id en la notificación del teléfono y en el toast: así no se repiten
  id: string
  url?: string
}

// Una clave mal copiada no debe tumbar el servidor: solo se apagan las notificaciones push
let vapidValido = false
if (config.vapid.publica && config.vapid.privada) {
  try {
    webpush.setVapidDetails(config.vapid.contacto, config.vapid.publica, config.vapid.privada)
    vapidValido = true
  } catch (err) {
    console.error('Notificaciones push desactivadas, revisa las variables VAPID:', (err as Error).message)
  }
}

export const pushActivo = () => vapidValido

/**
 * Envía una notificación a los usuarios activos: a todos menos `excepto` (quien hizo el cambio),
 * o solo a `soloUsuario` (para la prueba de notificaciones).
 */
export async function notificar(db: Db, aviso: Aviso, { excepto, soloUsuario }: { excepto?: number; soloUsuario?: number } = {}) {
  const resultado = { telefonos: 0, enviados: 0, errores: [] as string[] }
  if (!pushActivo()) return resultado
  const destinos = await db
    .select({ id: suscripciones.id, endpoint: suscripciones.endpoint, p256dh: suscripciones.p256dh, auth: suscripciones.auth })
    .from(suscripciones)
    .innerJoin(usuarios, eq(usuarios.id, suscripciones.usuarioId))
    .where(
      and(
        eq(usuarios.activo, true),
        excepto ? ne(suscripciones.usuarioId, excepto) : undefined,
        soloUsuario ? eq(suscripciones.usuarioId, soloUsuario) : undefined,
      ),
    )
  resultado.telefonos = destinos.length

  const payload = JSON.stringify({ url: '/entregas', ...aviso })
  const vencidas: number[] = []
  await Promise.allSettled(
    destinos.map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60,
          urgency: 'high',
          timeout: 8_000,
        })
        .then(() => {
          resultado.enviados++
        })
        .catch((err: { statusCode?: number; body?: string; message?: string }) => {
          resultado.errores.push(`${err.statusCode ?? ''} ${err.body || err.message || 'error'}`.trim().slice(0, 200))
          // 404/410: el navegador anuló el permiso o se desinstaló la app
          if (err.statusCode === 404 || err.statusCode === 410) vencidas.push(s.id)
        }),
    ),
  )
  if (vencidas.length) await db.delete(suscripciones).where(inArray(suscripciones.id, vencidas))
  if (resultado.errores.length) console.error('Errores al enviar notificaciones:', resultado.errores)
  return resultado
}

// --- Textos ---

const hora12 = (hora: string) => {
  const [h = 0, m = 0] = hora.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'p. m.' : 'a. m.'}`
}

export function fiambres(e: Pick<Entrega, 'enteros' | 'medios'>) {
  const partes = []
  if (e.enteros) partes.push(`${e.enteros} ${e.enteros === 1 ? 'entero' : 'enteros'}`)
  if (e.medios) partes.push(`${e.medios} ${e.medios === 1 ? 'medio' : 'medios'}`)
  return partes.join(', ')
}

// Guatemala no tiene horario de verano: siempre UTC-6
const ZONA = '-06:00'
export const hoyGuatemala = () => new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10)
const minutosPara = (e: Pick<Entrega, 'fecha' | 'hora'>) =>
  (new Date(`${e.fecha}T${e.hora}:00${ZONA}`).getTime() - Date.now()) / 60_000

const diaTexto = (fecha: string) =>
  fecha === hoyGuatemala()
    ? 'hoy'
    : new Date(`${fecha}T12:00:00${ZONA}`).toLocaleDateString('es-GT', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        timeZone: 'America/Guatemala',
      })

const urlDia = (fecha: string) => `/entregas?fecha=${fecha}`

export const avisoNueva = (e: Entrega): Aviso => ({
  id: `nueva-${e.id}`,
  titulo: `Nueva entrega · ${e.nombre}`,
  cuerpo: `${diaTexto(e.fecha)} a las ${hora12(e.hora)} · ${fiambres(e)}\n${e.direccion}`,
  url: urlDia(e.fecha),
})

export function avisoCambio(antes: Entrega, despues: Entrega): Aviso | null {
  const cambioHora = antes.fecha !== despues.fecha || antes.hora !== despues.hora
  const cambioLugar = antes.direccion !== despues.direccion || antes.lat !== despues.lat || antes.lng !== despues.lng
  if (!cambioHora && !cambioLugar) return null
  const partes = []
  if (cambioHora) partes.push(`ahora ${diaTexto(despues.fecha)} a las ${hora12(despues.hora)}`)
  if (cambioLugar) partes.push(`nueva dirección: ${despues.direccion}`)
  return {
    id: `cambio-${despues.id}-${despues.actualizadoEn.toISOString()}`,
    titulo: `${cambioHora && cambioLugar ? 'Cambio de hora y lugar' : cambioHora ? 'Cambio de hora' : 'Cambio de lugar'} · ${despues.nombre}`,
    cuerpo: partes.join('\n'),
    url: urlDia(despues.fecha),
  }
}

const distintoDe = (col: Column, valor: string) => or(isNull(col), ne(col, valor))

/**
 * Revisa las entregas pendientes de hoy y avisa las que pasaron a "advertencia" o "urgente".
 * Es seguro llamarla varias veces a la vez: cada aviso se marca en la base antes de enviarse.
 */
export async function revisarUrgencias(db: Db) {
  const hoy = hoyGuatemala()
  const [ajustes] = await db.select({ min: configuracion.minutosAdvertencia }).from(configuracion).limit(1)
  const minutosAdvertencia = ajustes?.min ?? 30

  const pendientes = await db
    .select()
    .from(entregas)
    .where(
      and(
        eq(entregas.fecha, hoy),
        eq(entregas.entregado, false),
        distintoDe(entregas.avisoEnviado, 'urgente'),
      ),
    )

  let enviados = 0
  for (const e of pendientes) {
    const min = minutosPara(e)
    const nivel = min < 0 ? 'urgente' : min <= minutosAdvertencia ? 'advertencia' : null
    if (!nivel || nivel === e.avisoEnviado) continue

    // Se marca primero; si otra revisión ya lo marcó, no se repite el aviso
    const [marcada] = await db
      .update(entregas)
      .set({ avisoEnviado: nivel })
      .where(and(eq(entregas.id, e.id), distintoDe(entregas.avisoEnviado, nivel), eq(entregas.entregado, false)))
      .returning({ id: entregas.id })
    if (!marcada) continue

    await notificar(db, {
      id: `${nivel}-${e.id}`,
      titulo: nivel === 'urgente' ? `⚠️ Atrasada · ${e.nombre}` : `⏰ Por llegar la hora · ${e.nombre}`,
      cuerpo: `${nivel === 'urgente' ? 'Era para las' : 'Es para las'} ${hora12(e.hora)} · ${fiambres(e)}\n${e.direccion}`,
      url: urlDia(e.fecha),
    })
    enviados++
  }
  return enviados
}
