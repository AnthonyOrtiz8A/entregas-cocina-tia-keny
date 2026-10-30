import L from 'leaflet'
import type { Entrega, Rol } from '../types'
import type { Urgencia } from './fechas'

// Centro de Chiquimulilla, Santa Rosa
export const CENTRO_PUEBLO: [number, number] = [14.0858359, -90.3803646]
export const ZOOM_PUEBLO = 15

export const REFERENCIA_PUEBLO = 'Chiquimulilla, Santa Rosa, Guatemala'

export function iconoPin(color = '#dc2626', etiqueta?: string | number) {
  const centro =
    etiqueta === undefined
      ? '<circle cx="16" cy="16" r="6" fill="#fff"/>'
      : `<circle cx="16" cy="16" r="10" fill="#fff"/><text x="16" y="20.5" text-anchor="middle" font-size="12" font-weight="700" font-family="system-ui,sans-serif" fill="${color}">${etiqueta}</text>`
  return L.divIcon({
    className: 'pin',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))"><path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>${centro}</svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  })
}

export const COLOR_URGENCIA: Record<Urgencia, string> = {
  urgente: '#dc2626',
  advertencia: '#d97706',
  normal: '#059669',
  entregada: '#78716c',
}

// Abre Google Maps con la ruta hacia el punto (o busca la dirección si no hay punto)
export function enlaceComoLlegar(e: Pick<Entrega, 'lat' | 'lng' | 'direccion'>) {
  if (e.lat != null && e.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.direccion}, ${REFERENCIA_PUEBLO}`)}`
}

export function enlaceWhatsApp(telefono: string) {
  const digitos = telefono.replace(/\D/g, '')
  return `https://wa.me/${digitos.length === 8 ? `502${digitos}` : digitos}`
}

// Punto azul de "tu ubicación"
export const iconoYo = L.divIcon({
  className: 'pin',
  html: '<span class="punto-yo"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const escaparHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Otra persona del equipo: círculo con moto (repartidor) o persona (administrador) y su nombre debajo
export function iconoCompanero(nombre: string, rol: Rol, viejo: boolean) {
  const color = viejo ? '#78716c' : '#2563eb'
  return L.divIcon({
    className: 'pin',
    html: `<div class="repartidor${viejo ? ' viejo' : ''}" style="--color:${color}"><span class="icono">${rol === 'admin' ? '👤' : '🛵'}</span><span class="nombre">${escaparHtml(nombre.split(' ')[0] ?? nombre)}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  })
}
