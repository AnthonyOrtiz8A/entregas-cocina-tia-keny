import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router'
import { useCambiarEstado, useEliminarEntrega } from '../hooks/useEntregas'
import { mensajeError } from '../lib/api'
import { type Urgencia, describirTiempo, hora12, minutosRestantes, quetzales } from '../lib/fechas'
import { enlaceComoLlegar, enlaceWhatsApp } from '../lib/mapa'
import { useEsAdmin } from '../store/auth'
import type { Entrega } from '../types'
import { MapaPunto } from './mapa/MapaPunto'

const ESTILO: Record<Urgencia, { borde: string; insignia: string; titulo: string }> = {
  urgente: { borde: 'border-l-red-600', insignia: 'bg-red-600 text-white', titulo: 'Urgente' },
  advertencia: { borde: 'border-l-amber-500', insignia: 'bg-amber-400 text-amber-950', titulo: 'Ya casi' },
  normal: { borde: 'border-l-emerald-600', insignia: 'bg-emerald-100 text-emerald-800', titulo: 'A tiempo' },
  entregada: { borde: 'border-l-stone-300', insignia: 'bg-stone-200 text-stone-700', titulo: 'Entregada' },
}

interface Props {
  entrega: Entrega
  numero: number
  urgencia: Urgencia
  ahora: number
}

function fiambresTexto(enteros: number, medios: number) {
  const partes = []
  if (enteros) partes.push(`${enteros} ${enteros === 1 ? 'entero' : 'enteros'}`)
  if (medios) partes.push(`${medios} ${medios === 1 ? 'medio' : 'medios'}`)
  return partes.join(' + ')
}

export function EntregaCard({ entrega: e, numero, urgencia, ahora }: Props) {
  const esAdmin = useEsAdmin()
  const [verMapa, setVerMapa] = useState(false)
  const cambiar = useCambiarEstado()
  const eliminar = useEliminarEntrega()
  const estilo = ESTILO[urgencia]
  const pendientePago = e.estadoPago === 'pendiente'

  function actualizar(cambios: { entregado?: boolean; estadoPago?: Entrega['estadoPago'] }, ok: string) {
    cambiar.mutate(
      { id: e.id, ...cambios },
      { onSuccess: () => toast.success(ok), onError: (err) => toast.error(mensajeError(err)) },
    )
  }

  function borrar() {
    if (!confirm(`¿Eliminar la entrega de ${e.nombre}? Esta acción no se puede deshacer.`)) return
    eliminar.mutate(e.id, {
      onSuccess: () => toast.success('Entrega eliminada'),
      onError: (err) => toast.error(mensajeError(err)),
    })
  }

  return (
    <article className={`tarjeta border-l-4 ${estilo.borde} ${e.entregado ? 'opacity-75' : ''}`}>
      <div className="space-y-3 p-4">
        <header className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-sm font-bold text-stone-600">
            {numero}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold leading-tight">{e.nombre}</h3>
            <p className="text-sm text-stone-600">
              <span className="font-semibold text-stone-900">{hora12(e.hora)}</span>
              {!e.entregado && <> · {describirTiempo(minutosRestantes(e, ahora))}</>}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${estilo.insignia}`}>
            {estilo.titulo}
          </span>
        </header>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Dirección</dt>
            <dd>{e.direccion}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Teléfono</dt>
            <dd className="flex flex-wrap gap-x-3">
              <a className="font-medium text-marca-700 underline" href={`tel:${e.telefono}`}>
                {e.telefono}
              </a>
              <a className="text-emerald-700 underline" href={enlaceWhatsApp(e.telefono)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Fiambres</dt>
            <dd className="font-semibold">{fiambresTexto(e.enteros, e.medios)}</dd>
          </div>
          {e.extras && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-stone-500">Extras</dt>
              <dd>
                {e.extras}
                {e.extrasMonto > 0 && <span className="text-stone-500"> ({quetzales(e.extrasMonto)})</span>}
              </dd>
            </div>
          )}
          {e.notas && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-stone-500">Notas</dt>
              <dd>{e.notas}</dd>
            </div>
          )}
        </dl>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-stone-500">Total</p>
            <p className="text-xl font-bold">{quetzales(e.total)}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              pendientePago ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {pendientePago ? 'Pago pendiente' : 'Pagado'}
          </span>
        </div>

        {verMapa && e.lat != null && e.lng != null && <MapaPunto lat={e.lat} lng={e.lng} />}

        <div className="flex flex-wrap gap-2">
          <button
            className={e.entregado ? 'btn-secundario' : 'btn-primario'}
            disabled={cambiar.isPending}
            onClick={() =>
              e.entregado
                ? actualizar({ entregado: false }, 'Marcada como no entregada')
                : actualizar({ entregado: true }, 'Entrega completada')
            }
          >
            {e.entregado ? 'Deshacer entrega' : '✓ Entregada'}
          </button>
          <button
            className="btn-secundario"
            disabled={cambiar.isPending}
            onClick={() =>
              pendientePago
                ? actualizar({ estadoPago: 'pagado' }, 'Pago registrado')
                : actualizar({ estadoPago: 'pendiente' }, 'Pago marcado como pendiente')
            }
          >
            {pendientePago ? 'Q Cobrado' : 'Pago pendiente'}
          </button>
          <a className="btn-secundario" href={enlaceComoLlegar(e)} target="_blank" rel="noreferrer">
            Cómo llegar
          </a>
          {e.lat != null && (
            <button className="btn-secundario" onClick={() => setVerMapa((v) => !v)}>
              {verMapa ? 'Ocultar mapa' : 'Ver mapa'}
            </button>
          )}
          {esAdmin && (
            <>
              {/* Una entrega entregada no se edita: hay que deshacerla primero */}
              {!e.entregado && (
                <Link className="btn-secundario" to={`/entregas/${e.id}/editar`}>
                  Editar
                </Link>
              )}
              <button className="btn text-red-700 hover:bg-red-50" onClick={borrar} disabled={eliminar.isPending}>
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
