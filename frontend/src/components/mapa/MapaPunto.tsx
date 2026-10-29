import { Marker } from 'react-leaflet'
import { iconoPin } from '../../lib/mapa'
import { BotonUbicacion, CapaUbicaciones } from './CapaUbicaciones'
import { MarcoMapa } from './MarcoMapa'

const pinRojo = iconoPin()

// Mapa de solo lectura con el punto rojo de una entrega
export function MapaPunto({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MarcoMapa center={[lat, lng]} zoom={17} alto="h-60" botones={<BotonUbicacion />}>
      <CapaUbicaciones />
      <Marker position={[lat, lng]} icon={pinRojo} />
    </MarcoMapa>
  )
}
