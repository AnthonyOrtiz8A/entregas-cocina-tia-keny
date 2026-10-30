import { and, count, eq, inArray, isNotNull, isNull, lte, ne, or, type Column } from 'drizzle-orm'
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
  // Lo que se lee en voz alta en los teléfonos/compus que tienen la app abierta
  voz?: string
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
const minutosPara = (e: { fecha: string; hora: string }) =>
  (new Date(`${e.fecha}T${e.hora}:00${ZONA}`).getTime() - Date.now()) / 60_000

const diaTexto = (fecha: string) =>
  fecha === hoyGuatemala()
    ? 'hoy'
    : new Date(`${fecha}T12:00:00${ZONA}`).toLocaleDateString('es-GT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'America/Guatemala',
      })

const urlDia = (fecha: string) => `/entregas?fecha=${fecha}`

/** "hoy a las 4:30 p. m." o "hoy, sin hora" */
const cuandoTexto = (fecha: string, hora: string | null) =>
  hora ? `${diaTexto(fecha)} a las ${hora12(hora)}` : `${diaTexto(fecha)}, sin hora`

// --- Voz (mismas frases que arma la app) ---

/** "las 4 y 30 de la tarde", "la 1 de la tarde", "las 12 del mediodía" */
export function horaHablada(hora: string) {
  const [h = 0, m = 0] = hora.split(':').map(Number)
  const h12 = h % 12 || 12
  const periodo = h === 12 && m === 0 ? 'del mediodía' : h < 5 ? 'de la madrugada' : h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche'
  return `${h12 === 1 ? 'la' : 'las'} ${h12}${m ? ` y ${m}` : ''} ${periodo}`
}

/** "las 4 y 30 de la tarde" (hoy), "el domingo 1 de noviembre a las…", o "hoy, sin hora definida" */
function cuandoHablado(fecha: string, hora: string | null) {
  const dia =
    fecha === hoyGuatemala()
      ? null
      : `el ${new Date(`${fecha}T12:00:00${ZONA}`).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guatemala' }).replace(',', '')}`
  if (!hora) return `${dia ?? 'hoy'}, sin hora definida`
  return dia ? `${dia} a ${horaHablada(hora)}` : horaHablada(hora)
}

export const avisoNueva = (e: Entrega): Aviso => ({
  id: `nueva-${e.id}`,
  titulo: `Nueva entrega · ${e.nombre}`,
  cuerpo: `${cuandoTexto(e.fecha, e.hora)} · ${fiambres(e)}\n${e.direccion}`,
  url: urlDia(e.fecha),
  voz: `Nueva entrega registrada para ${cuandoHablado(e.fecha, e.hora)}, para la dirección ${e.direccion}`,
})

/** `numero`: número de orden del pedido en su día (orden de llegada) */
export function avisoCambio(antes: Entrega, despues: Entrega, numero: number): Aviso | null {
  const cambioHora = antes.fecha !== despues.fecha || antes.hora !== despues.hora
  const cambioLugar = antes.direccion !== despues.direccion || antes.lat !== despues.lat || antes.lng !== despues.lng
  if (!cambioHora && !cambioLugar) return null
  const partes = []
  if (cambioHora) partes.push(`ahora ${cuandoTexto(despues.fecha, despues.hora)}`)
  if (cambioLugar) partes.push(`nueva dirección: ${despues.direccion}`)
  const nuevoHorario = cuandoHablado(despues.fecha, despues.hora)
  return {
    id: `cambio-${despues.id}-${despues.actualizadoEn.toISOString()}`,
    titulo: `${cambioHora && cambioLugar ? 'Cambio de hora y lugar' : cambioHora ? 'Cambio de hora' : 'Cambio de lugar'} · ${despues.nombre}`,
    cuerpo: partes.join('\n'),
    url: urlDia(despues.fecha),
    voz:
      cambioHora && cambioLugar
        ? `Cambio de hora y lugar del pedido número ${numero}. Nuevo horario ${nuevoHorario}, nueva dirección ${despues.direccion}`
        : cambioHora
          ? `Cambio de horario en la orden número ${numero}, nuevo horario ${nuevoHorario}`
          : `Cambio de dirección de la orden número ${numero}, nueva dirección ${despues.direccion}`,
  }
}

/** Número de orden del pedido en su día: cuántos pedidos de ese día se registraron antes que él, más uno */
export async function numeroDelDia(db: Db, e: Pick<Entrega, 'id' | 'fecha'>) {
  const [fila] = await db
    .select({ n: count() })
    .from(entregas)
    .where(and(eq(entregas.fecha, e.fecha), lte(entregas.id, e.id)))
  return fila?.n ?? 1
}

const distintoDe = (col: Column, valor: string) => or(isNull(col), ne(col, valor))

const minutosHablados = (min: number) => {
  const n = Math.max(1, Math.round(min))
  return n === 1 ? '1 minuto' : `${n} minutos`
}

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
        // Sin hora definida no hay advertencia ni atraso
        isNotNull(entregas.hora),
        distintoDe(entregas.avisoEnviado, 'urgente'),
      ),
    )

  let enviados = 0
  for (const e of pendientes) {
    if (!e.hora) continue
    const min = minutosPara({ fecha: e.fecha, hora: e.hora })
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
      voz:
        nivel === 'urgente'
          ? `Vas tarde, el pedido de ${e.nombre} llegó a su hora límite`
          : `Faltan ${minutosHablados(min)} para entregar el pedido de ${e.nombre}`,
    })
    enviados++
  }
  return enviados
}
