import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuth } from '../store/auth'
import type { Sesion } from '../types'

const baseURL = `${import.meta.env.VITE_API_URL ?? 'http://localhost:8787'}/api`

// Cliente HTTP único de la aplicación
export const api = axios.create({ baseURL, timeout: 20_000 })

api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Si varias peticiones fallan con 401 a la vez, solo se hace un refresh
let refreshEnCurso: Promise<string> | null = null

async function renovarToken() {
  const { refreshToken, setSesion } = useAuth.getState()
  if (!refreshToken) throw new Error('Sin sesión')
  const { data } = await axios.post<Sesion>(`${baseURL}/auth/refresh`, { refreshToken })
  setSesion(data)
  return data.accessToken
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _reintento?: boolean }) | undefined
    const esRutaAuth = original?.url?.startsWith('/auth/')
    if (error.response?.status !== 401 || !original || original._reintento || esRutaAuth) {
      return Promise.reject(error)
    }
    original._reintento = true
    try {
      refreshEnCurso ??= renovarToken().finally(() => {
        refreshEnCurso = null
      })
      const token = await refreshEnCurso
      original.headers.Authorization = `Bearer ${token}`
      return api(original)
    } catch {
      useAuth.getState().cerrarSesion()
      return Promise.reject(error)
    }
  },
)

export function mensajeError(error: unknown, porDefecto = 'Ocurrió un error') {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor'
    const msg = (error.response.data as { message?: string } | undefined)?.message
    if (msg) return msg
  }
  return porDefecto
}
