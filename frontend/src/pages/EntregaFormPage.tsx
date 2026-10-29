import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, type UseFormRegisterReturn, useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { z } from 'zod'
import { MapaSelector } from '../components/mapa/MapaSelector'
import { useCambiarEstado, useConfiguracion, useEntrega, useGuardarEntrega } from '../hooks/useEntregas'
import { mensajeError } from '../lib/api'
import { hoyISO, quetzales } from '../lib/fechas'
import type { Entrega } from '../types'

const numero = (msg = 'Escribe un número válido') => z.number({ error: msg }).min(0, 'No puede ser negativo')

const schema = z
  .object({
    nombre: z.string().trim().min(2, 'Escribe el nombre'),
    telefono: z
      .string()
      .trim()
      .regex(/^[\d\s+-]{8,20}$/, 'Teléfono inválido (mínimo 8 dígitos)'),
    direccion: z.string().trim().min(3, 'Escribe la dirección'),
    punto: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha'),
    hora: z.string().regex(/^\d{2}:\d{2}$/, 'Elige la hora'),
    enteros: numero().int(),
    medios: numero().int(),
    extras: z.string().trim().max(500),
    extrasMonto: numero(),
    total: numero(),
    estadoPago: z.enum(['pendiente', 'pagado']),
    notas: z.string().trim().max(500),
  })
  .refine((d) => d.enteros + d.medios > 0, { message: 'Agrega al menos un fiambre', path: ['enteros'] })

type Formulario = z.infer<typeof schema>

export function EntregaFormPage() {
  const { id } = useParams()
  const idNum = id ? Number(id) : undefined
  const { data: entrega, isLoading, isError } = useEntrega(idNum)

  if (idNum && isLoading) return <p className="tarjeta p-6 text-center text-stone-500">Cargando…</p>
  if (idNum && (isError || !entrega)) {
    return (
      <div className="tarjeta space-y-3 p-6 text-center">
        <p>No se encontró la entrega.</p>
        <Link to="/entregas" className="btn-secundario">
          Volver
        </Link>
      </div>
    )
  }
  if (entrega?.entregado) return <EntregaYaEntregada entrega={entrega} />
  return <FormularioEntrega key={entrega?.actualizadoEn} entrega={entrega} />
}

// Para editar una entrega ya entregada primero hay que deshacer la entrega
function EntregaYaEntregada({ entrega }: { entrega: Entrega }) {
  const cambiar = useCambiarEstado()
  return (
    <div className="tarjeta mx-auto max-w-lg space-y-4 p-6 text-center">
      <p className="text-4xl">🔒</p>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Esta entrega ya fue entregada</h1>
        <p className="text-stone-600">
          La entrega de <strong>{entrega.nombre}</strong> no se puede editar. Si necesitas cambiarla, primero deshaz la
          entrega.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to={`/entregas?fecha=${entrega.fecha}`} className="btn-secundario">
          Volver
        </Link>
        <button
          className="btn-primario"
          disabled={cambiar.isPending}
          onClick={() =>
            cambiar.mutate(
              { id: entrega.id, entregado: false },
              {
                onSuccess: () => toast.success('Entrega deshecha: ya puedes editarla'),
                onError: (err) => toast.error(mensajeError(err)),
              },
            )
          }
        >
          {cambiar.isPending ? 'Deshaciendo…' : 'Deshacer entrega y editar'}
        </button>
      </div>
    </div>
  )
}

function FormularioEntrega({ entrega }: { entrega?: Entrega }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: config } = useConfiguracion()
  const guardar = useGuardarEntrega()
  // En una entrega nueva el total se calcula solo hasta que lo editen a mano
  const [totalAutomatico, setTotalAutomatico] = useState(!entrega)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Formulario>({
    resolver: zodResolver(schema),
    defaultValues: entrega
      ? {
          ...entrega,
          punto: entrega.lat != null && entrega.lng != null ? { lat: entrega.lat, lng: entrega.lng } : null,
          extras: entrega.extras ?? '',
          notas: entrega.notas ?? '',
        }
      : {
          nombre: '',
          telefono: '',
          direccion: '',
          punto: null,
          fecha: params.get('fecha') ?? hoyISO(),
          hora: '',
          enteros: 1,
          medios: 0,
          extras: '',
          extrasMonto: 0,
          total: 0,
          estadoPago: 'pendiente',
          notas: '',
        },
  })

  const [enteros, medios, extrasMonto, total] = useWatch({
    control,
    name: ['enteros', 'medios', 'extrasMonto', 'total'],
  })
  const sugerido =
    (enteros || 0) * (config?.precioEntero ?? 0) + (medios || 0) * (config?.precioMedio ?? 0) + (extrasMonto || 0)

  useEffect(() => {
    if (totalAutomatico) setValue('total', Math.round(sugerido * 100) / 100)
  }, [sugerido, totalAutomatico, setValue])

  const onSubmit = handleSubmit(({ punto, extras, notas, ...resto }) => {
    guardar.mutate(
      {
        id: entrega?.id,
        datos: {
          ...resto,
          lat: punto?.lat ?? null,
          lng: punto?.lng ?? null,
          extras: extras || null,
          notas: notas || null,
        },
      },
      {
        onSuccess: (e) => {
          toast.success(entrega ? 'Entrega actualizada' : 'Entrega creada')
          navigate(`/entregas?fecha=${e.fecha}`)
        },
        onError: (err) => toast.error(mensajeError(err, 'No se pudo guardar')),
      },
    )
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{entrega ? 'Editar entrega' : 'Nueva entrega'}</h1>
        <button type="button" className="text-sm text-stone-600 underline" onClick={() => navigate(-1)}>
          Cancelar
        </button>
      </div>

      <Seccion titulo="Cliente">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombre" error={errors.nombre?.message}>
            <input className="input" autoComplete="off" {...register('nombre')} />
          </Campo>
          <Campo label="Teléfono" error={errors.telefono?.message}>
            <input className="input" type="tel" inputMode="tel" placeholder="5555 5555" {...register('telefono')} />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="¿Para cuándo?">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Día" error={errors.fecha?.message}>
            <input className="input" type="date" {...register('fecha')} />
          </Campo>
          <Campo label="Hora" error={errors.hora?.message}>
            <input className="input" type="time" {...register('hora')} />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Dirección">
        <Campo label="Dirección o referencias" error={errors.direccion?.message}>
          <textarea
            className="input min-h-20"
            placeholder="Ej. Barrio El Centro, casa verde frente a la iglesia"
            {...register('direccion')}
          />
        </Campo>
        <div>
          <p className="label">Punto en el mapa</p>
          <Controller
            control={control}
            name="punto"
            render={({ field }) => <MapaSelector valor={field.value} onCambio={field.onChange} />}
          />
        </div>
      </Seccion>

      <Seccion titulo="Pedido">
        <div className="grid grid-cols-2 gap-4">
          <Controller
            control={control}
            name="enteros"
            render={({ field }) => (
              <Contador label="Fiambres enteros" valor={field.value} onCambio={field.onChange} precio={config?.precioEntero} />
            )}
          />
          <Controller
            control={control}
            name="medios"
            render={({ field }) => (
              <Contador label="Medios fiambres" valor={field.value} onCambio={field.onChange} precio={config?.precioMedio} />
            )}
          />
        </div>
        {errors.enteros && <p className="error">{errors.enteros.message}</p>}

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Campo label="Extras (opcional)" error={errors.extras?.message}>
            <input className="input" placeholder="Ej. 2 litros de horchata, pan extra" {...register('extras')} />
          </Campo>
          <Campo label="Costo de extras (Q)" error={errors.extrasMonto?.message}>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              {...register('extrasMonto', { valueAsNumber: true })}
            />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Cobro">
        <Campo label="Total a cobrar (Q)" error={errors.total?.message}>
          <input
            className="input text-lg font-bold"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            {...register('total', { valueAsNumber: true, onChange: () => setTotalAutomatico(false) })}
          />
        </Campo>
        {!totalAutomatico && Math.abs((total || 0) - sugerido) > 0.009 && sugerido > 0 && (
          <p className="text-sm text-stone-600">
            Según precios: <strong>{quetzales(sugerido)}</strong>{' '}
            <button type="button" className="text-marca-700 underline" onClick={() => setTotalAutomatico(true)}>
              usar este total
            </button>
          </p>
        )}
        {!config?.precioEntero && !config?.precioMedio && (
          <p className="text-sm text-stone-500">
            Tip: configura los precios en <Link to="/configuracion" className="underline">Precios</Link> para calcular el
            total automáticamente.
          </p>
        )}

        <fieldset>
          <legend className="label">Pago</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <OpcionPago valor="pendiente" texto="Paga al recibir (pendiente)" registro={register('estadoPago')} />
            <OpcionPago valor="pagado" texto="Ya pagó" registro={register('estadoPago')} />
          </div>
        </fieldset>

        <Campo label="Notas (opcional)" error={errors.notas?.message}>
          <textarea className="input min-h-16" {...register('notas')} />
        </Campo>
      </Seccion>

      <div className="sticky bottom-0 -mx-4 border-t border-stone-200 bg-stone-100/95 px-4 py-3 backdrop-blur">
        <button className="btn-primario w-full py-3 text-base" disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : entrega ? 'Guardar cambios' : 'Crear entrega'}
        </button>
      </div>
    </form>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="tarjeta space-y-4 p-4">
      <h2 className="font-semibold text-stone-800">{titulo}</h2>
      {children}
    </section>
  )
}

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="error block">{error}</span>}
    </label>
  )
}

function Contador({
  label,
  valor,
  onCambio,
  precio,
}: {
  label: string
  valor: number
  onCambio: (n: number) => void
  precio?: number
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secundario size-11 shrink-0 p-0 text-xl" onClick={() => onCambio(Math.max(0, valor - 1))}>
          −
        </button>
        <input
          className="input min-w-0 px-1 text-center text-lg font-bold"
          type="number"
          inputMode="numeric"
          min="0"
          value={Number.isNaN(valor) ? '' : valor}
          onChange={(e) => onCambio(e.target.value === '' ? 0 : Math.max(0, Math.floor(Number(e.target.value))))}
          aria-label={label}
        />
        <button type="button" className="btn-secundario size-11 shrink-0 p-0 text-xl" onClick={() => onCambio(valor + 1)}>
          +
        </button>
      </div>
      {!!precio && <p className="mt-1 text-xs text-stone-500">{quetzales(precio)} c/u</p>}
    </div>
  )
}

function OpcionPago({
  valor,
  texto,
  registro,
}: {
  valor: string
  texto: string
  registro: UseFormRegisterReturn
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-300 bg-white px-3 py-2.5 has-[:checked]:border-marca-600 has-[:checked]:bg-marca-50">
      <input type="radio" value={valor} className="accent-marca-700" {...registro} />
      <span className="text-sm font-medium">{texto}</span>
    </label>
  )
}
