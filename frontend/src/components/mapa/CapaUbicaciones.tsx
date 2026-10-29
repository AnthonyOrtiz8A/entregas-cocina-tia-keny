import { Circle, Marker, Popup, useMap } from 'react-leaflet'
import { esUbicacionVieja, haceCuanto, useUbicacionesRepartidores } from '../../hooks/useUbicaciones'
import { iconoRepartidor, iconoYo } from '../../lib/mapa'
import { useAuth } from '../../store/auth'
import { useUbicacion } from '../../store/ubicacion'
import { claseBotonMapa } from './MarcoMapa'

/**
 * Capa común para los mapas:
 * - repartidor: su propio punto azul
 * - administrador: dónde está cada repartidor
 */
export function CapaUbicaciones() {
  const rol = useAuth((s) => s.usuario?.rol)
  return rol === 'admin' ? <Repartidores /> : <MiPunto />
}

function MiPunto() {
  const yo = useUbicacion((s) => s.miUbicacion)
  if (!yo) return null
  return (
    <>
      {yo.precision != null && yo.precision < 500 && (
        <Circle
          center={[yo.lat, yo.lng]}
          radius={yo.precision}
          pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.12 }}
          interactive={false}
        />
      )}
      <Marker position={[yo.lat, yo.lng]} icon={iconoYo} zIndexOffset={1000}>
        <Popup>Estás aquí</Popup>
      </Marker>
    </>
  )
}

function Repartidores() {
  const { data = [] } = useUbicacionesRepartidores()
  return data.map((r) => {
    const viejo = esUbicacionVieja(r.actualizadoEn)
    return (
      <Marker key={r.usuarioId} position={[r.lat, r.lng]} icon={iconoRepartidor(r.nombre, viejo)} zIndexOffset={900}>
        <Popup>
          <p className="font-semibold">{r.nombre}</p>
          <p className="text-sm">
            {viejo ? 'Última ubicación ' : 'Actualizado '}
            {haceCuanto(r.actualizadoEn)}
          </p>
        </Popup>
      </Marker>
    )
  })
}

/** Botón dentro del mapa: el repartidor se centra en sí mismo; el admin, en los repartidores */
export function BotonUbicacion() {
  const rol = useAuth((s) => s.usuario?.rol)
  return rol === 'admin' ? <BotonVerRepartidores /> : <BotonCentrarEnMi />
}

function BotonVerRepartidores() {
  const mapa = useMap()
  const { data = [] } = useUbicacionesRepartidores()
  if (data.length === 0) return null
  return (
    <button
      type="button"
      className={claseBotonMapa}
      onClick={() =>
        data.length === 1
          ? mapa.flyTo([data[0]!.lat, data[0]!.lng], 17)
          : mapa.flyToBounds(
              data.map((r) => [r.lat, r.lng] as [number, number]),
              { padding: [60, 60], maxZoom: 17 },
            )
      }
    >
      🛵 {data.length === 1 ? data[0]!.nombre.split(' ')[0] : `Repartidores (${data.length})`}
    </button>
  )
}

function BotonCentrarEnMi() {
  const mapa = useMap()
  const yo = useUbicacion((s) => s.miUbicacion)
  return (
    <button
      type="button"
      className={claseBotonMapa}
      disabled={!yo}
      onClick={() => yo && mapa.flyTo([yo.lat, yo.lng], Math.max(mapa.getZoom(), 17))}
    >
      {yo ? '◎ Dónde estoy' : 'Buscando tu ubicación…'}
    </button>
  )
}
