import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { useConfiguracion, useGuardarConfiguracion } from '../hooks/useEntregas'
import { mensajeError } from '../lib/api'
import type { Configuracion } from '../types'

const schema = z.object({
  precioEntero: z.number({ error: 'Escribe un precio' }).min(0, 'No puede ser negativo'),
  precioMedio: z.number({ error: 'Escribe un precio' }).min(0, 'No puede ser negativo'),
  minutosAdvertencia: z
    .number({ error: 'Escribe los minutos' })
    .int('Solo minutos enteros')
    .min(5, 'Mínimo 5 minutos')
    .max(240, 'Máximo 240 minutos'),
})

export function ConfiguracionPage() {
  const { data, isLoading } = useConfiguracion()
  if (isLoading || !data) return <p className="tarjeta p-6 text-center text-stone-500">Cargando…</p>
  return <FormularioConfiguracion inicial={data} />
}

function FormularioConfiguracion({ inicial }: { inicial: Configuracion }) {
  const guardar = useGuardarConfiguracion()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<Configuracion>({ resolver: zodResolver(schema), defaultValues: inicial })

  const onSubmit = handleSubmit((datos) =>
    guardar.mutate(datos, {
      onSuccess: (d) => {
        toast.success('Configuración guardada')
        reset(d)
      },
      onError: (err) => toast.error(mensajeError(err)),
    }),
  )

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-4" noValidate>
      <h1 className="text-2xl font-bold">Precios y avisos</h1>
      <section className="tarjeta space-y-4 p-4">
        <h2 className="font-semibold">Precios</h2>
        <p className="text-sm text-stone-600">Se usan para calcular el total de cada entrega nueva.</p>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Fiambre entero (Q)</span>
            <input className="input" type="number" step="0.01" min="0" inputMode="decimal" {...register('precioEntero', { valueAsNumber: true })} />
            {errors.precioEntero && <span className="error block">{errors.precioEntero.message}</span>}
          </label>
          <label className="block">
            <span className="label">Medio fiambre (Q)</span>
            <input className="input" type="number" step="0.01" min="0" inputMode="decimal" {...register('precioMedio', { valueAsNumber: true })} />
            {errors.precioMedio && <span className="error block">{errors.precioMedio.message}</span>}
          </label>
        </div>
      </section>
      <section className="tarjeta space-y-4 p-4">
        <h2 className="font-semibold">Aviso de hora</h2>
        <label className="block">
          <span className="label">Marcar en advertencia cuando falten (minutos)</span>
          <input className="input" type="number" min="5" max="240" inputMode="numeric" {...register('minutosAdvertencia', { valueAsNumber: true })} />
          {errors.minutosAdvertencia && <span className="error block">{errors.minutosAdvertencia.message}</span>}
        </label>
        <ul className="space-y-1 text-sm text-stone-600">
          <li>
            <span className="mr-2 inline-block size-2.5 rounded-full bg-emerald-600" />
            Normal: falta más que ese tiempo.
          </li>
          <li>
            <span className="mr-2 inline-block size-2.5 rounded-full bg-amber-500" />
            Advertencia: ya casi es la hora.
          </li>
          <li>
            <span className="mr-2 inline-block size-2.5 rounded-full bg-red-600" />
            Urgente: ya pasó la hora y no se ha entregado.
          </li>
        </ul>
      </section>
      <button className="btn-primario w-full" disabled={!isDirty || guardar.isPending}>
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
