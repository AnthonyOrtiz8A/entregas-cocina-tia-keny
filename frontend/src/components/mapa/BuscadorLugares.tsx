import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import { buscarLugares, contenidoPopupLugar, direccionDe, tipoDe, useLugares, type Lugar } from '../../lib/lugares'

/** Buscador de lugares conocidos dentro del mapa ("Domino's", "farmacia", "iglesia"…) */
export function BuscadorLugares({ onElegir }: { onElegir?: (l: Lugar) => void }) {
  const mapa = useMap()
  const { data: lugares = [] } = useLugares()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Los toques sobre el buscador no deben mover el mapa ni marcar puntos
  useEffect(() => {
    if (!ref.current) return
    L.DomEvent.disableClickPropagation(ref.current)
    L.DomEvent.disableScrollPropagation(ref.current)
  }, [])

  const resultados = buscarLugares(lugares, texto)

  function elegir(l: Lugar) {
    mapa.flyTo([l.lat, l.lng], 18)
    if (onElegir) onElegir(l)
    else {
      // Se abre al terminar el viaje para que el mapa lo acomode a la vista (no quede bajo los botones)
      mapa.once('moveend', () =>
        L.popup({ offset: [0, -12], autoPanPaddingTopLeft: [10, 60] })
          .setLatLng([l.lat, l.lng])
          .setContent(contenidoPopupLugar(l))
          .openOn(mapa),
      )
    }
    setAbierto(false)
    setTexto('')
  }

  return (
    <div ref={ref} className="absolute left-14 right-14 top-2.5 z-[1000] sm:right-auto sm:w-80">
      {abierto ? (
        <div className="overflow-hidden rounded-lg border-2 border-black/20 bg-white shadow-sm">
          <div className="flex items-center">
            <input
              autoFocus
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setAbierto(false)
                if (e.key === 'Enter' && resultados[0]) {
                  e.preventDefault()
                  elegir(resultados[0])
                }
              }}
              placeholder="Buscar: Domino's, farmacia, iglesia…"
              className="h-10 min-w-0 flex-1 px-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setAbierto(false)
                setTexto('')
              }}
              className="px-3 text-stone-500"
              aria-label="Cerrar buscador"
            >
              ✕
            </button>
          </div>
          {texto.trim().length >= 2 && (
            <ul className="max-h-56 overflow-y-auto border-t border-stone-200 text-sm">
              {resultados.length === 0 ? (
                <li className="px-3 py-2 text-stone-500">No se encontró ningún lugar</li>
              ) : (
                resultados.map((l) => (
                  <li key={`${l.n}-${l.lat}-${l.lng}`}>
                    <button
                      type="button"
                      onClick={() => elegir(l)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-stone-100"
                    >
                      <span>{tipoDe(l).icono}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{l.n}</span>
                        <span className="block truncate text-xs text-stone-500">
                          {tipoDe(l).nombre}
                          {l.d && ` · ${direccionDe(l)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex h-10 items-center gap-1.5 rounded-lg border-2 border-black/20 bg-white px-3 text-sm font-semibold text-stone-800 shadow-sm"
        >
          🔎 Buscar lugar
        </button>
      )}
    </div>
  )
}
