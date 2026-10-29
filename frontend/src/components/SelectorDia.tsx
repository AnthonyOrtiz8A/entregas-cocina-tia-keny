import { useResumenDias } from '../hooks/useEntregas'
import { fechaCorta, fechaLarga, hoyISO, nombreDia, sumarDias } from '../lib/fechas'

interface Props {
  fecha: string
  onCambio: (fecha: string) => void
}

export function SelectorDia({ fecha, onCambio }: Props) {
  const hoy = hoyISO()
  const { data: dias = [] } = useResumenDias(sumarDias(hoy, -1))

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          className="btn-secundario px-3"
          onClick={() => onCambio(sumarDias(fecha, -1))}
          aria-label="Día anterior"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-lg font-bold leading-tight first-letter:uppercase">{nombreDia(fecha)}</p>
          <p className="text-sm text-stone-500 first-letter:uppercase">{fechaLarga(fecha)}</p>
        </div>
        <button
          className="btn-secundario px-3"
          onClick={() => onCambio(sumarDias(fecha, 1))}
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <input
          type="date"
          className="input w-auto shrink-0 py-1.5 text-sm"
          value={fecha}
          onChange={(e) => e.target.value && onCambio(e.target.value)}
          aria-label="Elegir fecha"
        />
        {fecha !== hoy && (
          <button className="btn-secundario shrink-0 py-1.5" onClick={() => onCambio(hoy)}>
            Hoy
          </button>
        )}
        {dias.map((d) => (
          <button
            key={d.fecha}
            onClick={() => onCambio(d.fecha)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-left text-xs transition ${
              d.fecha === fecha
                ? 'border-marca-700 bg-marca-700 text-white'
                : 'border-stone-300 bg-white hover:border-marca-600'
            }`}
          >
            <span className="block font-semibold first-letter:uppercase">{fechaCorta(d.fecha)}</span>
            <span className={d.fecha === fecha ? 'text-marca-100' : 'text-stone-500'}>
              {d.pendientes > 0
                ? `${d.pendientes} ${d.pendientes === 1 ? 'pendiente' : 'pendientes'}`
                : 'todo entregado'}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
