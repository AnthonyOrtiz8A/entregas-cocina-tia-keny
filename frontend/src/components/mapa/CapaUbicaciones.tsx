import { Circle, Marker, Popup, useMap } from 'react-leaflet'
import { esUbicacionVieja, haceCuanto, useUbicacionesEquipo } from '../../hooks/useUbicaciones'
import { iconoCompanero, iconoYo } from '../../lib/mapa'
import { useUbicacion } from '../../store/ubicacion'
import { claseBotonMapa } from './MarcoMapa'

/** Capa común para los mapas: tu punto azul y dónde está cada persona del equipo */
export function CapaUbicaciones() {
  return (
    <>
      <Equipo />
      <MiPunto />
    </>
  )
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

function Equipo() {
  const { data = [] } = useUbicacionesEquipo()
  return data.map((u) => {
    const viejo = esUbicacionVieja(u.actualizadoEn)
    return (
      <Marker key={u.usuarioId} position={[u.lat, u.lng]} icon={iconoCompanero(u.nombre, u.rol, viejo)} zIndexOffset={900}>
        <Popup>
          <p className="font-semibold">{u.nombre}</p>
          <p className="text-sm">
            {u.rol === 'admin' ? 'Administrador' : 'Repartidor'} · {viejo ? 'última ubicación ' : 'actualizado '}
            {haceCuanto(u.actualizadoEn)}
          </p>
        </Popup>
      </Marker>
    )
  })
}

/** Botones dentro del mapa: centrarse en uno mismo y ver al resto del equipo */
export function BotonUbicacion() {
  return (
    <>
      <BotonCentrarEnMi />
      <BotonVerEquipo />
    </>
  )
}

function BotonVerEquipo() {
  const mapa = useMap()
  const { data = [] } = useUbicacionesEquipo()
  if (data.length === 0) return null
  return (
    <button
      type="button"
      className={claseBotonMapa}
      onClick={() =>
        data.length === 1
          ? mapa.flyTo([data[0]!.lat, data[0]!.lng], 17)
          : mapa.flyToBounds(
              data.map((u) => [u.lat, u.lng] as [number, number]),
              { padding: [60, 60], maxZoom: 17 },
            )
      }
    >
      🛵 {data.length === 1 ? data[0]!.nombre.split(' ')[0] : `Equipo (${data.length})`}
    </button>
  )
}

function BotonCentrarEnMi() {
  const mapa = useMap()
  const compartir = useUbicacion((s) => s.compartir)
  const yo = useUbicacion((s) => s.miUbicacion)
  if (!compartir) return null
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
