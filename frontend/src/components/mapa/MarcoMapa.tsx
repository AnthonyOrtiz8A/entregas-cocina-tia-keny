import L, { type Map as LeafletMap } from 'leaflet'
import { type ReactNode, type Ref, useEffect, useRef, useState } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import type { Lugar } from '../../lib/lugares'
import { BuscadorLugares } from './BuscadorLugares'
import { CapasMapa } from './CapasMapa'

interface Props {
  center: [number, number]
  zoom: number
  /** Clases de altura cuando NO está en pantalla completa, ej. "h-72" */
  alto: string
  children?: ReactNode
  /** Botones extra que se muestran junto al de pantalla completa (ya dentro del mapa) */
  botones?: ReactNode
  mapRef?: Ref<LeafletMap>
  /** Al elegir un lugar en el buscador (ej. para poner ahí el punto de entrega) */
  onElegirLugar?: (l: Lugar) => void
}

// Leaflet necesita recalcular su tamaño cuando cambia el contenedor
function AjustarTamano({ clave }: { clave: unknown }) {
  const mapa = useMap()
  useEffect(() => {
    const id = setTimeout(() => mapa.invalidateSize(), 50)
    return () => clearTimeout(id)
  }, [clave, mapa])
  return null
}

// Contenedor de botones dentro del mapa que no deja pasar los toques al mapa
function BarraBotones({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    L.DomEvent.disableClickPropagation(ref.current)
    L.DomEvent.disableScrollPropagation(ref.current)
  }, [])
  return (
    <div ref={ref} className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-[1000] flex flex-col items-start gap-2">
      {children}
    </div>
  )
}

export const claseBotonMapa =
  'flex h-10 items-center gap-1.5 rounded-lg border-2 border-black/20 bg-white px-3 text-sm font-semibold text-stone-800 shadow-sm active:bg-stone-100'

export function MarcoMapa({ center, zoom, alto, children, botones, mapRef, onElegirLugar }: Props) {
  const [completa, setCompleta] = useState(false)
  const pidioPantallaNativa = useRef(false)

  function entrar() {
    setCompleta(true)
    // En Android/PC además se ocultan las barras del navegador; en iPhone basta el modo CSS
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => (pidioPantallaNativa.current = true))
        .catch(() => {})
    }
  }

  function salir() {
    setCompleta(false)
    if (pidioPantallaNativa.current && document.fullscreenElement) document.exitFullscreen().catch(() => {})
    pidioPantallaNativa.current = false
  }

  useEffect(() => {
    if (!completa) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && salir()
    // Si el usuario sale de la pantalla completa del navegador (gesto atrás), cerramos también
    const cambio = () => {
      if (pidioPantallaNativa.current && !document.fullscreenElement) {
        pidioPantallaNativa.current = false
        setCompleta(false)
      }
    }
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', tecla)
    document.addEventListener('fullscreenchange', cambio)
    return () => {
      document.body.style.overflow = overflowPrevio
      window.removeEventListener('keydown', tecla)
      document.removeEventListener('fullscreenchange', cambio)
    }
  }, [completa])

  return (
    <div
      className={
        completa
          ? 'fixed inset-0 z-[1200] h-dvh w-screen bg-stone-200'
          : `relative w-full overflow-hidden rounded-lg border border-stone-200 ${alto}`
      }
    >
      <MapContainer ref={mapRef} center={center} zoom={zoom} className="h-full w-full">
        <CapasMapa />
        <AjustarTamano clave={completa} />
        <BuscadorLugares onElegir={onElegirLugar} />
        {children}
        <BarraBotones>
          {botones}
          <button
            type="button"
            className={claseBotonMapa}
            onClick={completa ? salir : entrar}
            aria-label={completa ? 'Salir de pantalla completa' : 'Ver mapa en pantalla completa'}
          >
            {completa ? '✕ Cerrar' : '⛶ Pantalla completa'}
          </button>
        </BarraBotones>
      </MapContainer>
    </div>
  )
}
