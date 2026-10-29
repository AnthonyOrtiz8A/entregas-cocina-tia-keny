import L from 'leaflet'
import { useEffect } from 'react'
import { Marker, Popup, useMap } from 'react-leaflet'
import { hora12, urgenciaDe } from '../../lib/fechas'
import { CENTRO_PUEBLO, COLOR_URGENCIA, ZOOM_PUEBLO, enlaceComoLlegar, iconoPin } from '../../lib/mapa'
import { useEsAdmin } from '../../store/auth'
import type { Entrega } from '../../types'
import { BotonUbicacion, CapaUbicaciones } from './CapaUbicaciones'
import { MarcoMapa } from './MarcoMapa'

interface Props {
  entregas: Entrega[]
  numeros: number[]
  ahora: number
  minutosAdvertencia: number
}

function AjustarVista({ puntos }: { puntos: [number, number][] }) {
  const mapa = useMap()
  const firma = puntos.map((p) => p.join(',')).join('|')
  // Solo reajusta cuando cambian los puntos (firma), no en cada render
  useEffect(() => {
    if (puntos.length === 1) mapa.setView(puntos[0]!, 17)
    else if (puntos.length > 1) mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 17 })
  }, [firma, mapa])
  return null
}

export function MapaEntregas({ entregas, numeros, ahora, minutosAdvertencia }: Props) {
  const conPunto = entregas.filter((e) => e.lat != null && e.lng != null)
  const sinPunto = entregas.length - conPunto.length
  const esAdmin = useEsAdmin()

  return (
    <div className="space-y-2">
      <MarcoMapa center={CENTRO_PUEBLO} zoom={ZOOM_PUEBLO} alto="h-[65vh] min-h-80 bg-white shadow-sm" botones={<BotonUbicacion />}>
        <CapaUbicaciones />
        <AjustarVista puntos={conPunto.map((e) => [e.lat!, e.lng!])} />
        {conPunto.map((e) => (
          <Marker
            key={e.id}
            position={[e.lat!, e.lng!]}
            icon={iconoPin(COLOR_URGENCIA[urgenciaDe(e, ahora, minutosAdvertencia)], numeros[entregas.indexOf(e)])}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">
                  #{numeros[entregas.indexOf(e)]} · {e.nombre}
                </p>
                <p>{hora12(e.hora)}</p>
                <p>{e.direccion}</p>
                <a href={enlaceComoLlegar(e)} target="_blank" rel="noreferrer">
                  Cómo llegar →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarcoMapa>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
        <Leyenda color={COLOR_URGENCIA.urgente} texto="Urgente" />
        <Leyenda color={COLOR_URGENCIA.advertencia} texto="Por llegar la hora" />
        <Leyenda color={COLOR_URGENCIA.normal} texto="A tiempo" />
        <Leyenda color={COLOR_URGENCIA.entregada} texto="Entregada" />
        {esAdmin ? <Leyenda color="#2563eb" texto="Repartidor" /> : <Leyenda color="#2563eb" texto="Tú" />}
        {sinPunto > 0 && <span className="text-amber-700">{sinPunto} sin punto en el mapa</span>}
      </div>
    </div>
  )
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  )
}
