import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { useAuth, useEsAdmin } from '../store/auth'
import { useUbicacion } from '../store/ubicacion'

export interface UbicacionRepartidor {
  usuarioId: number
  nombre: string
  lat: number
  lng: number
  precision: number | null
  actualizadoEn: string
}

const ENVIO_MINIMO_MS = 15_000 // no enviar más seguido que esto
const LATIDO_MS = 60_000 // reenviar aunque no se mueva, para que se vea "en línea"

function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6_371_000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/**
 * Para repartidores: sigue la ubicación del teléfono mientras la app está abierta,
 * la muestra en sus mapas y la envía al servidor para que el administrador la vea.
 */
export function useSeguimientoUbicacion() {
  const esRepartidor = useAuth((s) => s.usuario?.rol === 'repartidor')
  const { compartir, setMiUbicacion, setError } = useUbicacion()
  const ultimoEnvio = useRef<{ lat: number; lng: number; fecha: number } | null>(null)
  const activo = esRepartidor && compartir

  useEffect(() => {
    if (!activo) return
    if (!window.isSecureContext || !navigator.geolocation) {
      setError('La ubicación solo funciona con https (o en localhost)')
      return
    }

    const enviar = (lat: number, lng: number, precision: number | null, forzar = false) => {
      const previo = ultimoEnvio.current
      const ahora = Date.now()
      const muyPronto = previo && ahora - previo.fecha < ENVIO_MINIMO_MS
      const casiIgual = previo && distanciaMetros(previo, { lat, lng }) < 10
      if (!forzar && (muyPronto || (casiIgual && ahora - previo.fecha < LATIDO_MS))) return
      ultimoEnvio.current = { lat, lng, fecha: ahora }
      api.put('/ubicacion', { lat, lng, precision }).catch(() => {
        // Sin conexión: se reintenta con la siguiente lectura
        ultimoEnvio.current = previo
      })
    }

    const id = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const precision = Number.isFinite(coords.accuracy) ? Math.round(coords.accuracy) : null
        setMiUbicacion({ lat: coords.latitude, lng: coords.longitude, precision, fecha: Date.now() })
        enviar(coords.latitude, coords.longitude, precision)
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Actívalo en la configuración del navegador.'
            : 'No se pudo obtener la ubicación',
        )
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )

    // Latido: si el teléfono no se mueve, watchPosition no avisa
    const latido = setInterval(() => {
      const p = useUbicacion.getState().miUbicacion
      if (p) enviar(p.lat, p.lng, p.precision, true)
    }, LATIDO_MS)

    return () => {
      navigator.geolocation.clearWatch(id)
      clearInterval(latido)
    }
  }, [activo, setMiUbicacion, setError])

  // Al apagar el interruptor se borra su ubicación del servidor
  const estabaActivo = useRef(activo)
  useEffect(() => {
    if (estabaActivo.current && !activo && esRepartidor) {
      ultimoEnvio.current = null
      api.delete('/ubicacion').catch(() => {})
    }
    estabaActivo.current = activo
  }, [activo, esRepartidor])
}

/** Para administradores: última ubicación de cada repartidor */
export function useUbicacionesRepartidores() {
  const esAdmin = useEsAdmin()
  return useQuery({
    queryKey: ['ubicaciones', 'repartidores'],
    queryFn: async () => (await api.get<UbicacionRepartidor[]>('/ubicacion/repartidores')).data,
    enabled: esAdmin,
    refetchInterval: 15_000,
  })
}

export function haceCuanto(fecha: string | number, ahora = Date.now()) {
  const min = Math.floor((ahora - new Date(fecha).getTime()) / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  return `hace ${Math.floor(min / 60)} h`
}

// Más de 5 minutos sin noticias: probablemente cerró la app o perdió señal
export const esUbicacionVieja = (fecha: string, ahora = Date.now()) =>
  ahora - new Date(fecha).getTime() > 5 * 60_000
