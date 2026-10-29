import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { useCrearUsuario, useEditarUsuario, useUsuarios } from '../hooks/useUsuarios'
import { mensajeError } from '../lib/api'
import { useAuth } from '../store/auth'
import type { Usuario } from '../types'

const schema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre'),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[a-z0-9._-]+$/, 'Solo letras, números, punto o guion'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol: z.enum(['admin', 'repartidor']),
})

export function UsuariosPage() {
  const { data: usuarios = [], isLoading } = useUsuarios()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuarios</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <section className="space-y-2">
          {isLoading ? (
            <p className="tarjeta p-6 text-center text-stone-500">Cargando…</p>
          ) : (
            usuarios.map((u) => <FilaUsuario key={u.id} usuario={u} />)
          )}
        </section>
        <NuevoUsuario />
      </div>
    </div>
  )
}

function FilaUsuario({ usuario: u }: { usuario: Usuario }) {
  const yo = useAuth((s) => s.usuario)
  const editar = useEditarUsuario()
  const soyYo = yo?.id === u.id

  function aplicar(cambios: Parameters<typeof editar.mutate>[0], ok: string) {
    editar.mutate(cambios, { onSuccess: () => toast.success(ok), onError: (err) => toast.error(mensajeError(err)) })
  }

  function cambiarPassword() {
    const password = prompt(`Nueva contraseña para ${u.nombre} (mínimo 6 caracteres):`)
    if (password === null) return
    if (password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')
    aplicar({ id: u.id, password }, 'Contraseña actualizada')
  }

  return (
    <div className={`tarjeta flex flex-wrap items-center gap-3 p-4 ${u.activo ? '' : 'opacity-60'}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {u.nombre} {soyYo && <span className="text-xs font-normal text-stone-500">(tú)</span>}
        </p>
        <p className="text-sm text-stone-500">
          @{u.usuario} · {u.rol === 'admin' ? 'Administrador' : 'Repartidor'}
          {!u.activo && ' · Desactivado'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="input w-auto py-1.5 text-sm"
          value={u.rol}
          disabled={soyYo || editar.isPending}
          onChange={(e) => aplicar({ id: u.id, rol: e.target.value as Usuario['rol'] }, 'Rol actualizado')}
          aria-label="Rol"
        >
          <option value="repartidor">Repartidor</option>
          <option value="admin">Administrador</option>
        </select>
        <button className="btn-secundario py-1.5" onClick={cambiarPassword} disabled={editar.isPending}>
          Contraseña
        </button>
        {!soyYo && (
          <button
            className="btn-secundario py-1.5"
            disabled={editar.isPending}
            onClick={() =>
              aplicar({ id: u.id, activo: !u.activo }, u.activo ? 'Usuario desactivado' : 'Usuario activado')
            }
          >
            {u.activo ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>
    </div>
  )
}

function NuevoUsuario() {
  const crear = useCrearUsuario()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', usuario: '', password: '', rol: 'repartidor' as const },
  })

  const onSubmit = handleSubmit((datos) =>
    crear.mutate(datos, {
      onSuccess: (u) => {
        toast.success(`Usuario ${u.usuario} creado`)
        reset()
      },
      onError: (err) => toast.error(mensajeError(err)),
    }),
  )

  return (
    <form onSubmit={onSubmit} className="tarjeta h-fit space-y-3 p-4" noValidate>
      <h2 className="font-semibold">Agregar usuario</h2>
      <label className="block">
        <span className="label">Nombre</span>
        <input className="input" {...register('nombre')} />
        {errors.nombre && <span className="error block">{errors.nombre.message}</span>}
      </label>
      <label className="block">
        <span className="label">Usuario</span>
        <input className="input" autoCapitalize="none" autoComplete="off" {...register('usuario')} />
        {errors.usuario && <span className="error block">{errors.usuario.message}</span>}
      </label>
      <label className="block">
        <span className="label">Contraseña</span>
        <input className="input" type="text" autoComplete="new-password" {...register('password')} />
        {errors.password && <span className="error block">{errors.password.message}</span>}
      </label>
      <label className="block">
        <span className="label">Rol</span>
        <select className="input" {...register('rol')}>
          <option value="repartidor">Repartidor (ve y marca entregas)</option>
          <option value="admin">Administrador (todo)</option>
        </select>
      </label>
      <button className="btn-primario w-full" disabled={crear.isPending}>
        {crear.isPending ? 'Creando…' : 'Crear usuario'}
      </button>
    </form>
  )
}
