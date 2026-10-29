import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { api, mensajeError } from '../lib/api'
import { useAuth } from '../store/auth'
import type { Sesion } from '../types'

const loginSchema = z.object({
  usuario: z.string().trim().min(1, 'Escribe tu usuario'),
  password: z.string().min(1, 'Escribe tu contraseña'),
})

const setupSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Escribe tu nombre'),
    usuario: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, 'Mínimo 3 caracteres')
      .regex(/^[a-z0-9._-]+$/, 'Solo letras, números, punto o guion'),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, { message: 'Las contraseñas no coinciden', path: ['confirmar'] })

export function LoginPage() {
  const usuario = useAuth((s) => s.usuario)
  const location = useLocation()
  const destino = (location.state as { desde?: string } | null)?.desde ?? '/entregas'

  const { data: estado, isLoading, isError, refetch } = useQuery({
    queryKey: ['estado-inicial'],
    queryFn: async () => (await api.get<{ necesitaConfiguracion: boolean }>('/auth/estado')).data,
    enabled: !usuario,
  })

  if (usuario) return <Navigate to={destino} replace />

  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-marca-700 to-marca-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <p className="text-3xl font-black tracking-tight">Cocina Tía Keny</p>
          <p className="text-marca-100">Control de entregas de fiambre</p>
        </div>
        <div className="tarjeta p-6">
          {isLoading ? (
            <p className="py-6 text-center text-stone-500">Conectando…</p>
          ) : isError ? (
            <div className="space-y-3 py-2 text-center">
              <p className="text-stone-700">No se pudo conectar con el servidor.</p>
              <button className="btn-secundario" onClick={() => refetch()}>
                Reintentar
              </button>
            </div>
          ) : estado?.necesitaConfiguracion ? (
            <FormularioSetup destino={destino} />
          ) : (
            <FormularioLogin destino={destino} />
          )}
        </div>
      </div>
    </div>
  )
}

function FormularioLogin({ destino }: { destino: string }) {
  const setSesion = useAuth((s) => s.setSesion)
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) })

  const onSubmit = handleSubmit(async (datos) => {
    try {
      const { data } = await api.post<Sesion>('/auth/login', datos)
      setSesion(data)
      toast.success(`¡Hola, ${data.usuario.nombre}!`)
      navigate(destino, { replace: true })
    } catch (err) {
      toast.error(mensajeError(err, 'No se pudo iniciar sesión'))
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h1 className="text-xl font-bold">Iniciar sesión</h1>
      <div>
        <label className="label" htmlFor="usuario">
          Usuario
        </label>
        <input id="usuario" className="input" autoComplete="username" autoCapitalize="none" {...register('usuario')} />
        {errors.usuario && <p className="error">{errors.usuario.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input id="password" type="password" className="input" autoComplete="current-password" {...register('password')} />
        {errors.password && <p className="error">{errors.password.message}</p>}
      </div>
      <button className="btn-primario w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function FormularioSetup({ destino }: { destino: string }) {
  const setSesion = useAuth((s) => s.setSesion)
  const navigate = useNavigate()
  const [verPassword, setVerPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(setupSchema) })

  const onSubmit = handleSubmit(async ({ confirmar: _, ...datos }) => {
    try {
      const { data } = await api.post<Sesion>('/auth/setup', datos)
      setSesion(data)
      toast.success('Administrador creado')
      navigate(destino, { replace: true })
    } catch (err) {
      toast.error(mensajeError(err))
    }
  })

  const tipo = verPassword ? 'text' : 'password'

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="text-xl font-bold">Primer uso</h1>
        <p className="text-sm text-stone-600">Crea la cuenta de administrador para empezar.</p>
      </div>
      <div>
        <label className="label" htmlFor="nombre">
          Tu nombre
        </label>
        <input id="nombre" className="input" {...register('nombre')} />
        {errors.nombre && <p className="error">{errors.nombre.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="usuario">
          Usuario
        </label>
        <input id="usuario" className="input" autoCapitalize="none" autoComplete="username" {...register('usuario')} />
        {errors.usuario && <p className="error">{errors.usuario.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="password">
          Contraseña
        </label>
        <input id="password" type={tipo} className="input" autoComplete="new-password" {...register('password')} />
        {errors.password && <p className="error">{errors.password.message}</p>}
      </div>
      <div>
        <label className="label" htmlFor="confirmar">
          Repite la contraseña
        </label>
        <input id="confirmar" type={tipo} className="input" autoComplete="new-password" {...register('confirmar')} />
        {errors.confirmar && <p className="error">{errors.confirmar.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input type="checkbox" checked={verPassword} onChange={(e) => setVerPassword(e.target.checked)} />
        Mostrar contraseña
      </label>
      <button className="btn-primario w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear administrador'}
      </button>
    </form>
  )
}
