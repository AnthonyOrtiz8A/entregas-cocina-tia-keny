import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../store/auth'
import type { Rol } from '../types'

// Sin sesión → login. Con sesión pero sin el rol requerido → inicio.
export function RutaProtegida({ roles }: { roles?: Rol[] }) {
  const usuario = useAuth((s) => s.usuario)
  const location = useLocation()

  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/entregas" replace />
  return <Outlet />
}
