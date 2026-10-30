import { esUbicacionVieja, haceCuanto, useUbicacionesEquipo } from '../hooks/useUbicaciones'
import { useAhora } from '../hooks/useAhora'
import { mensajeError } from '../lib/api'

// Resumen para todos: quién más del equipo está compartiendo su ubicación
export function PanelRepartidores({ onVerMapa }: { onVerMapa: () => void }) {
  const { data = [], isError, error } = useUbicacionesEquipo()
  const ahora = useAhora()

  return (
    <section className="tarjeta flex flex-wrap items-center gap-2 px-3 py-2.5">
      <span className="text-sm font-semibold text-stone-700">🛵 Equipo:</span>
      {isError && data.length === 0 ? (
        <span className="text-sm text-red-700">no se pudieron cargar las ubicaciones ({mensajeError(error)})</span>
      ) : data.length === 0 ? (
        <span className="text-sm text-stone-500">nadie más está compartiendo su ubicación</span>
      ) : (
        data.map((u) => {
          const viejo = esUbicacionVieja(u.actualizadoEn, ahora)
          return (
            <span
              key={u.usuarioId}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                viejo ? 'bg-stone-100 text-stone-500' : 'bg-blue-50 text-blue-800'
              }`}
            >
              <span className={`size-2 rounded-full ${viejo ? 'bg-stone-400' : 'bg-blue-600'}`} />
              {u.nombre} · {haceCuanto(u.actualizadoEn, ahora)}
            </span>
          )
        })
      )}
      {data.length > 0 && (
        <button onClick={onVerMapa} className="ml-auto text-sm font-medium text-marca-700 underline">
          Ver en el mapa
        </button>
      )}
    </section>
  )
}
