import type { LatLngBounds } from 'leaflet'
import { useMemo, useState } from 'react'
import { Marker, Popup, useMapEvents } from 'react-leaflet'
import { direccionDe, iconoLugar, importancia, tipoDe, useLugares } from '../../lib/lugares'

// Desde este zoom se ven los íconos, y desde el otro también los nombres
const ZOOM_ICONOS = 15
const ZOOM_NOMBRES = 17

/**
 * Negocios y lugares conocidos de la zona, como en Google Maps: a cada zoom solo se muestran
 * los que caben sin encimarse, empezando por los más conocidos; al acercarse aparecen los demás.
 */
export function CapaLugares() {
  const { data: lugares = [] } = useLugares()
  const [vista, setVista] = useState<{ zoom: number; limites: LatLngBounds } | null>(null)
  const mapa = useMapEvents({
    zoomend: () => setVista({ zoom: mapa.getZoom(), limites: mapa.getBounds().pad(0.3) }),
    moveend: () => setVista({ zoom: mapa.getZoom(), limites: mapa.getBounds().pad(0.3) }),
  })
  const zoom = vista?.zoom ?? mapa.getZoom()
  const limites = vista?.limites ?? mapa.getBounds().pad(0.3)
  const conNombre = zoom >= ZOOM_NOMBRES

  // Ordenados por importancia una sola vez
  const ordenados = useMemo(() => [...lugares].sort((a, b) => importancia(b) - importancia(a)), [lugares])

  // Lugares que caben a este zoom (no depende de mover el mapa, así no "saltan" al arrastrar)
  const quecaben = useMemo(() => {
    if (zoom < ZOOM_ICONOS) return []
    // Espacio que ocupa cada uno en pantalla: solo el ícono, o el ícono con su nombre debajo
    const ancho = conNombre ? 96 : 30
    const alto = conNombre ? 40 : 30
    const puestos: { x: number; y: number }[] = []
    const elegidos = []
    for (const l of ordenados) {
      const { x, y } = mapa.project([l.lat, l.lng], zoom)
      if (puestos.some((p) => Math.abs(p.x - x) < ancho && Math.abs(p.y - y) < alto)) continue
      puestos.push({ x, y })
      elegidos.push(l)
    }
    return elegidos
  }, [ordenados, zoom, conNombre, mapa])

  // Y de esos, solo los que están a la vista, para que el mapa siga rápido en el teléfono
  const visibles = useMemo(() => quecaben.filter((l) => limites.contains([l.lat, l.lng])), [quecaben, limites])

  return visibles.map((l) => (
    <Marker
      key={`${l.n}-${l.lat}-${l.lng}`}
      position={[l.lat, l.lng]}
      icon={iconoLugar(l, conNombre)}
      zIndexOffset={-1000}
      // Deja pasar el toque al mapa: así en "Punto en el mapa" se puede marcar la entrega sobre un lugar
      bubblingMouseEvents
    >
      <Popup>
        <p className="font-semibold">{l.n}</p>
        <p className="text-stone-600">{tipoDe(l).nombre}</p>
        {l.d && <p className="text-stone-600">{direccionDe(l)}</p>}
      </Popup>
    </Marker>
  ))
}
