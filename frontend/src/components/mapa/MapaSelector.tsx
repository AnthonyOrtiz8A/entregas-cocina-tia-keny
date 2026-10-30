import type { Map as LeafletMap } from 'leaflet'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Marker, useMapEvents } from 'react-leaflet'
import { CENTRO_PUEBLO, ZOOM_PUEBLO, iconoPin } from '../../lib/mapa'
import { MarcoMapa } from './MarcoMapa'

export interface Punto {
  lat: number
  lng: number
}

interface Props {
  valor: Punto | null
  onCambio: (p: Punto | null) => void
}

const pinRojo = iconoPin()
const redondear = (n: number) => Math.round(n * 1e6) / 1e6

function ClickEnMapa({ onCambio }: Pick<Props, 'onCambio'>) {
  useMapEvents({
    click: (e) => onCambio({ lat: redondear(e.latlng.lat), lng: redondear(e.latlng.lng) }),
  })
  return null
}

export function MapaSelector({ valor, onCambio }: Props) {
  const mapa = useRef<LeafletMap>(null)
  const [buscando, setBuscando] = useState(false)

  function miUbicacion() {
    if (!navigator.geolocation) return toast.error('Tu dispositivo no permite ubicación')
    setBuscando(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = { lat: redondear(coords.latitude), lng: redondear(coords.longitude) }
        onCambio(p)
        mapa.current?.flyTo([p.lat, p.lng], 18)
        setBuscando(false)
      },
      () => {
        toast.error('No se pudo obtener tu ubicación')
        setBuscando(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="space-y-2">
      <MarcoMapa
        mapRef={mapa}
        center={valor ? [valor.lat, valor.lng] : CENTRO_PUEBLO}
        zoom={valor ? 17 : ZOOM_PUEBLO}
        alto="h-72 sm:h-80"
        // Elegir un lugar en el buscador pone ahí el punto de entrega (luego se puede arrastrar)
        onElegirLugar={(l) => onCambio({ lat: redondear(l.lat), lng: redondear(l.lng) })}
      >
        <ClickEnMapa onCambio={onCambio} />
        {valor && (
          <Marker
            position={[valor.lat, valor.lng]}
            icon={pinRojo}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onCambio({ lat: redondear(lat), lng: redondear(lng) })
              },
            }}
          />
        )}
      </MarcoMapa>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="btn-secundario py-1.5" onClick={miUbicacion} disabled={buscando}>
          {buscando ? 'Buscando…' : '📍 Usar mi ubicación'}
        </button>
        {valor && (
          <button type="button" className="btn-secundario py-1.5" onClick={() => onCambio(null)}>
            Quitar punto
          </button>
        )}
        <span className="text-stone-500">
          {valor ? 'Arrastra el punto rojo para ajustarlo.' : 'Toca el mapa donde se debe entregar.'}
        </span>
      </div>
    </div>
  )
}
