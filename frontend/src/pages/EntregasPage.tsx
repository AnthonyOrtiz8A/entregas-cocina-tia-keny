import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { EntregaCard } from '../components/EntregaCard'
import { MapaEntregas } from '../components/mapa/MapaEntregas'
import { PanelRepartidores } from '../components/PanelRepartidores'
import { SelectorDia } from '../components/SelectorDia'
import { useAhora } from '../hooks/useAhora'
import { useConfiguracion, useEntregasDelDia } from '../hooks/useEntregas'
import { mensajeError } from '../lib/api'
import { hoyISO, quetzales, urgenciaDe } from '../lib/fechas'
import { useEsAdmin } from '../store/auth'

type Filtro = 'pendientes' | 'entregadas' | 'todas'
type Vista = 'lista' | 'mapa'

const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: 'pendientes', texto: 'Pendientes' },
  { valor: 'entregadas', texto: 'Entregadas' },
  { valor: 'todas', texto: 'Todas' },
]

export function EntregasPage() {
  const [params, setParams] = useSearchParams()
  const fecha = params.get('fecha') ?? hoyISO()
  const filtro = (params.get('filtro') as Filtro | null) ?? 'pendientes'
  const vista = (params.get('vista') as Vista | null) ?? 'lista'
  const esAdmin = useEsAdmin()
  const ahora = useAhora()

  const { data: entregas = [], isLoading, isError, error } = useEntregasDelDia(fecha)
  const { data: config } = useConfiguracion()
  const minutosAdvertencia = config?.minutosAdvertencia ?? 30

  function cambiarParam(clave: string, valor: string) {
    setParams(
      (p) => {
        p.set(clave, valor)
        return p
      },
      { replace: true },
    )
  }

  const resumen = useMemo(() => {
    const pendientes = entregas.filter((e) => !e.entregado)
    return {
      pendientes: pendientes.length,
      urgentes: pendientes.filter((e) => urgenciaDe(e, ahora, minutosAdvertencia) === 'urgente').length,
      enteros: pendientes.reduce((s, e) => s + e.enteros, 0),
      medios: pendientes.reduce((s, e) => s + e.medios, 0),
      porCobrar: entregas.filter((e) => e.estadoPago === 'pendiente').reduce((s, e) => s + e.total, 0),
    }
  }, [entregas, ahora, minutosAdvertencia])

  // El número de cada entrega sigue el orden por hora del día completo
  const visibles = entregas
    .map((e, i) => ({ entrega: e, numero: i + 1 }))
    .filter(({ entrega }) =>
      filtro === 'pendientes' ? !entrega.entregado : filtro === 'entregadas' ? entrega.entregado : true,
    )
    .sort((a, b) => Number(a.entrega.entregado) - Number(b.entrega.entregado))

  return (
    <div className="space-y-4">
      <section className="tarjeta p-4">
        <SelectorDia fecha={fecha} onCambio={(f) => cambiarParam('fecha', f)} />
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Dato titulo="Por entregar" valor={resumen.pendientes} />
        <Dato titulo="Urgentes" valor={resumen.urgentes} alerta={resumen.urgentes > 0} />
        <Dato titulo="Fiambres pendientes" valor={`${resumen.enteros} ent · ${resumen.medios} med`} />
        <Dato titulo="Por cobrar" valor={quetzales(resumen.porCobrar)} />
      </section>

      {esAdmin && <PanelRepartidores onVerMapa={() => cambiarParam('vista', 'mapa')} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-stone-200 p-1">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => cambiarParam('filtro', f.valor)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                filtro === f.valor ? 'bg-white shadow-sm' : 'text-stone-600'
              }`}
            >
              {f.texto}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-stone-200 p-1">
          {(['lista', 'mapa'] as const).map((v) => (
            <button
              key={v}
              onClick={() => cambiarParam('vista', v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                vista === v ? 'bg-white shadow-sm' : 'text-stone-600'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {esAdmin && (
          <Link to={`/entregas/nueva?fecha=${fecha}`} className="btn-primario ml-auto">
            + Nueva entrega
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="tarjeta h-40 animate-pulse bg-stone-200/60" />
          ))}
        </div>
      ) : isError ? (
        <p className="tarjeta p-6 text-center text-red-700">{mensajeError(error)}</p>
      ) : vista === 'mapa' ? (
        <MapaEntregas
          entregas={visibles.map((v) => v.entrega)}
          numeros={visibles.map((v) => v.numero)}
          ahora={ahora}
          minutosAdvertencia={minutosAdvertencia}
        />
      ) : visibles.length === 0 ? (
        <div className="tarjeta p-8 text-center text-stone-500">
          {entregas.length === 0
            ? 'No hay entregas para este día.'
            : filtro === 'pendientes'
              ? '¡Todo entregado! 🎉'
              : 'Nada que mostrar con este filtro.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(({ entrega, numero }) => (
            <EntregaCard
              key={entrega.id}
              entrega={entrega}
              numero={numero}
              ahora={ahora}
              urgencia={urgenciaDe(entrega, ahora, minutosAdvertencia)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Dato({ titulo, valor, alerta }: { titulo: string; valor: string | number; alerta?: boolean }) {
  return (
    <div className={`tarjeta px-3 py-2.5 ${alerta ? 'border-red-300 bg-red-50' : ''}`}>
      <p className="text-xs text-stone-500">{titulo}</p>
      <p className={`text-lg font-bold ${alerta ? 'text-red-700' : ''}`}>{valor}</p>
    </div>
  )
}
