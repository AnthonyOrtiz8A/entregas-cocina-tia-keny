import toast from 'react-hot-toast'
import { usePreferencias } from '../store/preferencias'
import type { Entrega } from '../types'
import { api } from './api'
import { fechaLarga, hoyISO, hora12 } from './fechas'
import { hablar, marcarLeido } from './voz'

export interface Aviso {
  titulo: string
  cuerpo: string
  // El mismo id llega por push y por la revisión local: así el toast y la notificación no se repiten
  id: string
  url?: string
  // Lo que se lee en voz alta con la app abierta
  voz?: string
}

// --- Textos (los mismos que arma el servidor) ---

export function fiambres(e: Pick<Entrega, 'enteros' | 'medios'>) {
  const partes = []
  if (e.enteros) partes.push(`${e.enteros} ${e.enteros === 1 ? 'entero' : 'enteros'}`)
  if (e.medios) partes.push(`${e.medios} ${e.medios === 1 ? 'medio' : 'medios'}`)
  return partes.join(', ')
}

const diaTexto = (fecha: string) => (fecha === hoyISO() ? 'hoy' : fechaLarga(fecha))
const urlDia = (fecha: string) => `/entregas?fecha=${fecha}`

/** "las 4 y 30 de la tarde", "la 1 de la tarde", "las 12 del mediodía" */
export function horaHablada(hora: string) {
  const [h = 0, m = 0] = hora.split(':').map(Number)
  const h12 = h % 12 || 12
  const periodo =
    h === 12 && m === 0 ? 'del mediodía' : h < 5 ? 'de la madrugada' : h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche'
  return `${h12 === 1 ? 'la' : 'las'} ${h12}${m ? ` y ${m}` : ''} ${periodo}`
}

const cuandoHablado = (fecha: string, hora: string) =>
  fecha === hoyISO() ? horaHablada(hora) : `el ${fechaLarga(fecha).replace(',', '')} a ${horaHablada(hora)}`

const minutosHablados = (min: number) => {
  const n = Math.max(1, Math.round(min))
  return n === 1 ? '1 minuto' : `${n} minutos`
}

export const avisoNueva = (e: Entrega): Aviso => ({
  id: `nueva-${e.id}`,
  titulo: `Nueva entrega · ${e.nombre}`,
  cuerpo: `${diaTexto(e.fecha)} a las ${hora12(e.hora)} · ${fiambres(e)}\n${e.direccion}`,
  url: urlDia(e.fecha),
  voz: `Nueva entrega registrada para ${cuandoHablado(e.fecha, e.hora)}, para la dirección ${e.direccion}`,
})

/** `numero`: número de orden del pedido en su día (orden de llegada) */
export function avisoCambio(antes: Entrega, despues: Entrega, numero: number): Aviso | null {
  const cambioHora = antes.fecha !== despues.fecha || antes.hora !== despues.hora
  const cambioLugar = antes.direccion !== despues.direccion || antes.lat !== despues.lat || antes.lng !== despues.lng
  if (!cambioHora && !cambioLugar) return null
  const partes = []
  if (cambioHora) partes.push(`ahora ${diaTexto(despues.fecha)} a las ${hora12(despues.hora)}`)
  if (cambioLugar) partes.push(`nueva dirección: ${despues.direccion}`)
  const tipo = cambioHora && cambioLugar ? 'Cambio de hora y lugar' : cambioHora ? 'Cambio de hora' : 'Cambio de lugar'
  const nuevoHorario = cuandoHablado(despues.fecha, despues.hora)
  return {
    id: `cambio-${despues.id}-${despues.actualizadoEn}`,
    titulo: `${tipo} · ${despues.nombre}`,
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

export const avisoUrgencia = (e: Entrega, nivel: 'advertencia' | 'urgente', minutosRestantes: number): Aviso => ({
  id: `${nivel}-${e.id}`,
  titulo: nivel === 'urgente' ? `⚠️ Atrasada · ${e.nombre}` : `⏰ Por llegar la hora · ${e.nombre}`,
  cuerpo: `${nivel === 'urgente' ? 'Era para las' : 'Es para las'} ${hora12(e.hora)} · ${fiambres(e)}\n${e.direccion}`,
  url: urlDia(e.fecha),
  voz:
    nivel === 'urgente'
      ? `Vas tarde, el pedido de ${e.nombre} llegó a su hora límite`
      : `Faltan ${minutosHablados(minutosRestantes)} para entregar el pedido de ${e.nombre}`,
})

// --- Mostrar ---

/** Toast dentro de la app y también notificación del teléfono (si dio permiso) */
export function avisar(aviso: Aviso) {
  const urgente = aviso.id.startsWith('urgente')
  toast(
    <div className="text-sm">
      <p className="font-semibold">{aviso.titulo}</p>
      <p className="whitespace-pre-line text-stone-600">{aviso.cuerpo}</p>
    </div>,
    {
      id: aviso.id,
      duration: urgente ? 12_000 : 8_000,
      icon: aviso.id.startsWith('nueva') ? '🆕' : urgente ? '🚨' : aviso.id.startsWith('advertencia') ? '⏰' : '✏️',
    },
  )
  mostrarNotificacion(aviso).catch(() => {})
  if (aviso.voz && usePreferencias.getState().voz && marcarLeido(aviso.id)) hablar(aviso.voz)
}

// Si el mismo aviso llega también por push, el mismo `tag` hace que se reemplace y no se repita
async function mostrarNotificacion(aviso: Aviso) {
  if (!notificacionesSoportadas() || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker.getRegistration()
  await reg?.showNotification(aviso.titulo, {
    body: aviso.cuerpo,
    tag: aviso.id,
    icon: '/icono-192.png',
    badge: '/icono-192.png',
    data: { url: aviso.url ?? '/entregas' },
  })
}

// Cambios hechos desde este teléfono: no se avisan a uno mismo
const propios = new Map<number, number>()
export const marcarCambioPropio = (id: number) => propios.set(id, Date.now())
export const esCambioPropio = (id: number) => Date.now() - (propios.get(id) ?? 0) < 5 * 60_000

// --- Notificaciones push (teléfono) ---

export const notificacionesSoportadas = () => 'Notification' in window && 'serviceWorker' in navigator

export const pushSoportado = () => notificacionesSoportadas() && 'PushManager' in window

// iPhone solo permite notificaciones si la app se agregó a la pantalla de inicio
export const esIphoneSinInstalar = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches &&
  !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone)

export function registrarServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
}

function claveABytes(base64: string) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const binario = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binario, (c) => c.charCodeAt(0))
}

export type EstadoSuscripcion = 'sin-soporte' | 'sin-permiso' | 'servidor-sin-claves' | 'suscrito'

/** Suscribe este teléfono al usuario actual (si ya dio permiso) */
export async function sincronizarSuscripcion(): Promise<EstadoSuscripcion> {
  if (!pushSoportado()) return 'sin-soporte'
  if (Notification.permission !== 'granted') return 'sin-permiso'
  const { data } = await api.get<{ clave: string | null }>('/push/clave')
  // Sin claves en el servidor quedan los toasts y las notificaciones con la app abierta
  if (!data.clave) return 'servidor-sin-claves'
  const reg = await navigator.serviceWorker.ready
  const clave = claveABytes(data.clave)

  let sub = await reg.pushManager.getSubscription()
  // Si el servidor cambió de clave hay que volver a suscribirse
  const claveActual = sub?.options.applicationServerKey
  if (sub && claveActual && !new Uint8Array(claveActual).every((b, i) => b === clave[i])) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave })
  await api.post('/push/suscripcion', sub.toJSON())
  return 'suscrito'
}

/** Pide permiso (debe llamarse desde un toque del usuario) y suscribe */
export async function activarNotificaciones() {
  const permiso = await Notification.requestPermission()
  if (permiso === 'granted') await sincronizarSuscripcion()
  return permiso
}

export interface ResultadoPrueba {
  configurado: boolean
  telefonos: number
  enviados: number
  errores: string[]
}

/** Manda una notificación de prueba a los teléfonos del usuario actual */
export async function probarNotificaciones() {
  const estado = await sincronizarSuscripcion()
  const { data } = await api.post<ResultadoPrueba>('/push/prueba')
  return { estado, ...data }
}

/** Al cerrar sesión este teléfono deja de recibir avisos de esa cuenta */
export async function quitarSuscripcion() {
  if (!pushSoportado()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await api.delete('/push/suscripcion', { data: { endpoint: sub.endpoint } })
}
