import toast from 'react-hot-toast'
import type { Entrega } from '../types'
import { api } from './api'
import { fechaLarga, hoyISO, hora12 } from './fechas'

export interface Aviso {
  titulo: string
  cuerpo: string
  // El mismo id llega por push y por la revisión local: así el toast y la notificación no se repiten
  id: string
  url?: string
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
  const tipo = cambioHora && cambioLugar ? 'Cambio de hora y lugar' : cambioHora ? 'Cambio de hora' : 'Cambio de lugar'
  return {
    id: `cambio-${despues.id}-${despues.actualizadoEn}`,
    titulo: `${tipo} · ${despues.nombre}`,
    cuerpo: partes.join('\n'),
    url: urlDia(despues.fecha),
  }
}

export const avisoUrgencia = (e: Entrega, nivel: 'advertencia' | 'urgente'): Aviso => ({
  id: `${nivel}-${e.id}`,
  titulo: nivel === 'urgente' ? `⚠️ Atrasada · ${e.nombre}` : `⏰ Por llegar la hora · ${e.nombre}`,
  cuerpo: `${nivel === 'urgente' ? 'Era para las' : 'Es para las'} ${hora12(e.hora)} · ${fiambres(e)}\n${e.direccion}`,
  url: urlDia(e.fecha),
})

// --- Mostrar ---

/** Toast dentro de la app y, si la app no está a la vista, también notificación del teléfono */
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
  if (document.visibilityState === 'hidden') mostrarNotificacion(aviso)
}

async function mostrarNotificacion(aviso: Aviso) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const reg = await navigator.serviceWorker?.getRegistration()
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

/** Suscribe este teléfono al usuario actual (si ya dio permiso) */
export async function sincronizarSuscripcion() {
  if (!pushSoportado() || Notification.permission !== 'granted') return
  const { data } = await api.get<{ clave: string | null }>('/push/clave')
  if (!data.clave) return // el servidor no tiene push configurado: quedan los avisos dentro de la app
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
}

/** Pide permiso (debe llamarse desde un toque del usuario) y suscribe */
export async function activarNotificaciones() {
  const permiso = await Notification.requestPermission()
  if (permiso === 'granted') await sincronizarSuscripcion()
  return permiso
}

/** Al cerrar sesión este teléfono deja de recibir avisos de esa cuenta */
export async function quitarSuscripcion() {
  if (!pushSoportado()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await api.delete('/push/suscripcion', { data: { endpoint: sub.endpoint } })
}
