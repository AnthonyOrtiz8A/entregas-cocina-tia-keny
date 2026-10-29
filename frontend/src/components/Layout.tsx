import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSeguimientoUbicacion } from '../hooks/useUbicaciones'
import { api } from '../lib/api'
import { useAuth, useEsAdmin } from '../store/auth'
import { useUbicacion } from '../store/ubicacion'
import type { Usuario } from '../types'

const enlace = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-marca-100 hover:bg-white/10 hover:text-white'
  }`

export function Layout() {
  const { usuario, setUsuario, cerrarSesion } = useAuth()
  const esAdmin = useEsAdmin()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useSeguimientoUbicacion()

  // Refresca nombre y rol por si un administrador los cambió
  const { data: yo } = useQuery({
    queryKey: ['yo'],
    queryFn: async () => (await api.get<Usuario>('/auth/me')).data,
    staleTime: 5 * 60_000,
  })
  useEffect(() => {
    if (yo) setUsuario(yo)
  }, [yo, setUsuario])

  async function salir() {
    // El repartidor deja de aparecer en el mapa del administrador al cerrar sesión
    if (!esAdmin) await api.delete('/ubicacion').catch(() => {})
    cerrarSesion()
    qc.clear()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-[1100] bg-marca-700 pt-[env(safe-area-inset-top)] text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold leading-tight">Cocina Tía Keny</p>
            <p className="truncate text-xs text-marca-100">
              {usuario?.nombre} · {usuario?.rol === 'admin' ? 'Administrador' : 'Repartidor'}
            </p>
          </div>
          <BotonPantallaCompleta />
          <button onClick={salir} className="rounded-lg px-3 py-1.5 text-sm text-marca-100 hover:bg-white/10">
            Salir
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-3 pb-2">
          <NavLink to="/entregas" end className={enlace}>
            Entregas
          </NavLink>
          {esAdmin ? (
            <>
              <NavLink to="/entregas/nueva" className={enlace}>
                + Nueva
              </NavLink>
              <NavLink to="/usuarios" className={enlace}>
                Usuarios
              </NavLink>
              <NavLink to="/configuracion" className={enlace}>
                Precios
              </NavLink>
            </>
          ) : (
            <InterruptorUbicacion />
          )}
        </nav>
      </header>
      <AvisoUbicacion />
      <main className="mx-auto max-w-5xl px-4 py-4 pb-16">
        <Outlet />
      </main>
    </div>
  )
}

// Oculta las barras del navegador (Android y computadoras). En iPhone no existe: se usa "Agregar a inicio".
function BotonPantallaCompleta() {
  const [activa, setActiva] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const cambio = () => setActiva(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', cambio)
    return () => document.removeEventListener('fullscreenchange', cambio)
  }, [])

  if (!document.fullscreenEnabled) return null
  return (
    <button
      onClick={() =>
        (activa ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
      }
      className="rounded-lg px-2.5 py-1.5 text-lg leading-none text-marca-100 hover:bg-white/10"
      aria-label={activa ? 'Salir de pantalla completa' : 'Pantalla completa'}
      title={activa ? 'Salir de pantalla completa' : 'Pantalla completa'}
    >
      {activa ? '⤡' : '⛶'}
    </button>
  )
}

function InterruptorUbicacion() {
  const { compartir, setCompartir, miUbicacion, error } = useUbicacion()
  const estado = !compartir ? 'apagada' : error ? 'error' : miUbicacion ? 'activa' : 'buscando'
  const texto = {
    apagada: 'Ubicación apagada',
    error: 'Ubicación sin acceso',
    buscando: 'Buscando ubicación…',
    activa: 'Compartiendo ubicación',
  }[estado]
  const punto = { apagada: 'bg-stone-400', error: 'bg-red-400', buscando: 'bg-amber-300', activa: 'bg-emerald-400' }[
    estado
  ]

  return (
    <button
      onClick={() => setCompartir(!compartir)}
      className="ml-auto flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
      aria-pressed={compartir}
      title={compartir ? 'Toca para dejar de compartir tu ubicación' : 'Toca para compartir tu ubicación'}
    >
      <span className={`size-2 rounded-full ${punto} ${estado === 'activa' ? 'animate-pulse' : ''}`} />
      {texto}
    </button>
  )
}

function AvisoUbicacion() {
  const esRepartidor = useAuth((s) => s.usuario?.rol === 'repartidor')
  const { compartir, error } = useUbicacion()
  if (!esRepartidor || !compartir || !error) return null
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800">{error}</div>
  )
}
