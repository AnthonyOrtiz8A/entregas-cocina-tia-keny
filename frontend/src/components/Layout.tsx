import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAvisos } from '../hooks/useAvisos'
import { useSeguimientoUbicacion } from '../hooks/useUbicaciones'
import { api } from '../lib/api'
import {
  activarNotificaciones,
  esIphoneSinInstalar,
  notificacionesSoportadas,
  pushSoportado,
  quitarSuscripcion,
} from '../lib/avisos'
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
  useAvisos()

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
    // Deja de aparecer en el mapa y este teléfono deja de recibir avisos de esta cuenta
    await Promise.allSettled([api.delete('/ubicacion'), quitarSuscripcion()])
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
          ) : null}
          <InterruptorUbicacion />
        </nav>
      </header>
      <AvisoUbicacion />
      <AvisoNotificaciones />
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

// Invita a activar las notificaciones del teléfono (el permiso solo se puede pedir con un toque)
function AvisoNotificaciones() {
  const [permiso, setPermiso] = useState(() => (notificacionesSoportadas() ? Notification.permission : 'denied'))
  const [oculto, setOculto] = useState(() => sessionStorage.getItem('ocultar-aviso-notificaciones') === '1')
  const [activando, setActivando] = useState(false)

  if (oculto) return null

  if (esIphoneSinInstalar() && !pushSoportado()) {
    return (
      <BarraAviso onCerrar={() => ocultar()}>
        🔔 Para recibir notificaciones en iPhone: toca <b>Compartir</b> → <b>Agregar a pantalla de inicio</b> y abre la
        app desde ese ícono.
      </BarraAviso>
    )
  }
  if (permiso !== 'default') return null

  function ocultar() {
    sessionStorage.setItem('ocultar-aviso-notificaciones', '1')
    setOculto(true)
  }

  async function activar() {
    setActivando(true)
    try {
      const resultado = await activarNotificaciones()
      setPermiso(resultado)
      if (resultado === 'granted') toast.success('Notificaciones activadas')
      else toast.error('No se dio permiso para las notificaciones')
    } catch {
      toast.error('No se pudieron activar las notificaciones')
    } finally {
      setActivando(false)
    }
  }

  return (
    <BarraAviso onCerrar={ocultar}>
      <span>🔔 Activa las notificaciones para enterarte de entregas nuevas, cambios y atrasos.</span>
      <button className="btn-primario ml-2 py-1 text-xs" onClick={activar} disabled={activando}>
        {activando ? 'Activando…' : 'Activar'}
      </button>
    </BarraAviso>
  )
}

function BarraAviso({ children, onCerrar }: { children: ReactNode; onCerrar: () => void }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-y-1">{children}</div>
        <button onClick={onCerrar} className="px-2 text-amber-700" aria-label="Cerrar aviso">
          ✕
        </button>
      </div>
    </div>
  )
}

function AvisoUbicacion() {
  const { compartir, error } = useUbicacion()
  if (!compartir || !error) return null
  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800">{error}</div>
  )
}
